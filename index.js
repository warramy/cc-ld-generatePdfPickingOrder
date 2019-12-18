var AWS = require("aws-sdk");
const { Pool } = require('pg');  //  Needs the nodePostgres Lambda Layer.

const PROD_MODE = true;
const DEV_USERNAME = 'nuttdrive@gmail.com';
const SYSTEM_CODE = '02';
const PRIVILEGE_CODE = '4.1.1';
const PG_DB = "master"
const PG_SCHEMA = "stock"
const TABLE_TRANSER_ORDER = 'transfer_order'
const TABLE_TRANSER_ORDER_ITEM = 'transfer_order_item'
const TABLE_STOCK_ITEM = 'stock_item'
const TABLE_STOCK_LOT = 'stock_lot'

let docClient = new AWS.DynamoDB.DocumentClient();
const pool = new Pool();
const createPDF = require('./createPDF')


exports.handler = async (event, context) => {
    console.log("event => ", event);
    context.callbackWaitsForEmptyEventLoop = false; // !important to reuse pool

    // Get Username from header
    const username = PROD_MODE ? getUsername(event.requestContext) : DEV_USERNAME;
    if (username == null) {
        doResponse(context, 401, { message: "Unauthorize user " })
        return
    }

    // Get UserSession from DynamoDB
    const userSession = await getUserSession(username, SYSTEM_CODE);
    if (userSession.error != null) {
        doResponse(context, 401, userSession.error)
        return
    }
    const warehouseCode = userSession.data.selectedWarehouseCode;

    // Check User Permission from DynamoDB
    const hasPermission = await checkPermission(username, SYSTEM_CODE, PRIVILEGE_CODE);
    if (hasPermission.error != null) {
        doResponse(context, 401, hasPermission.error)
        return
    }

    const { trNumber } = event.pathParameters != null ? event.pathParameters : { trNumber: null }
    console.log('trNumber => ', trNumber)

    if (trNumber == null) {
        doResponse(context, 401, { message: 'trNumber not found.' })
        return
    }

    // Start Business Logic here
    const client = await pool.connect();
    let pickingOrderRes;
    let new_pickingOrderRes;
    let responsePDF
    try {
        // Get PickingOrders by user's warehouse
        console.log("query transfer_order by trNumber and warehouseCode");
        const params = queryPickingOrderWithTrNumber(warehouseCode, trNumber)
        pickingOrderRes = await client.query(params.text, params.value);

        if (pickingOrderRes.rowCount == 0) {
            throw { message: 'trNumber not found.' }
        } else {
            // Get PickingOrdersItem by user's warehouse and trNumber
            console.log("query transfer_order_item by trNumber");
            const paramsPickingOrderItem = queryPickingOrderItemWithTrNumber(trNumber)
            let pickingOrderItemRes = await client.query(paramsPickingOrderItem.text, paramsPickingOrderItem.value);
            //set data for pdf
            console.log('set data for pdf file')
            new_pickingOrderRes = pickingOrderRes.rows[0]
            new_pickingOrderRes.items = pickingOrderItemRes.rows

            console.log('get binLocation from stock_item and find nearest expiredDate');
            for (let i = 0; i < new_pickingOrderRes.items.length; i++) {

                // get binLocation from stock_item
                const { productItemCode } = new_pickingOrderRes.items[i]
                const paramQueryStockItem = queryStockItem(warehouseCode, productItemCode);
                const queryStockItemRes = await client.query(paramQueryStockItem.text, paramQueryStockItem.value);
                if (queryStockItemRes.rowCount == 0) {
                    throw { message: 'productItemCode not found in stock_item' }
                }

                const { binLocation } = queryStockItemRes.rows[0]
                new_pickingOrderRes.items[i].binLocation = binLocation

                //find nearest expiredDate
                const paramQueryStockLot = queryCheckStockLot(warehouseCode, productItemCode);
                const queryStockLotRes = await client.query(paramQueryStockLot.text, paramQueryStockLot.value);
                if (queryStockLotRes.rowCount == 0) {
                    throw { message: 'productItemCode not found in stock_lot' }
                }

                const { expiredDate } = queryStockLotRes.rows[0]
                new_pickingOrderRes.items[i].nearestExpiredDate = expiredDate
            }

            console.log('new_pickingOrderRes => ', new_pickingOrderRes);

            const createPDFRes = await createPDF.genFilePDFAndUploadPDF(new_pickingOrderRes)
            console.log('createPDFRes => ', createPDFRes);
            //set response
            console.log("set response");
            responsePDF = {
                fileUrl: createPDFRes.Location || '',
                key: createPDFRes.key || ''
            }

        }

    } catch (err) {
        console.log('catch err => ', err);
        doResponse(context, 401, err)
        return
    }
    finally {
        client.release(true);
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify(responsePDF),
    };
    console.log("response: ", response);
    return response;
};


function queryCheckStockLot(warehouseCode, productItemCode) {
    const queryText = `select "expiredDate"
    from ${PG_DB}.${PG_SCHEMA}.${TABLE_STOCK_LOT}
    where "warehouseCode" = $1 and "productItemCode" = $2 and "quantity" != 0
    order by "expiredDate" ,id asc;`
    const query = {
        text: queryText,
        value: [warehouseCode, productItemCode]
    }
    return query
}


function queryStockItem(warehouse, productItemCode) {
    const queryText = `select "binLocation"
    from ${PG_DB}.${PG_SCHEMA}.${TABLE_STOCK_ITEM}
    where "warehouseCode" = $1 and "productItemCode" = $2;`
    const query = {
        text: queryText,
        value: [warehouse, productItemCode]
    }
    return query
}

function queryPickingOrderWithTrNumber(warehouse, trNumber) {
    const queryText = `select *
    from ${PG_DB}.${PG_SCHEMA}.${TABLE_TRANSER_ORDER}
    where "fromWarehouseCode" = $1 and "trNumber" = $2;`
    const query = {
        text: queryText,
        value: [warehouse, trNumber]
    }
    return query
}

function queryPickingOrderItemWithTrNumber(trNumber) {
    const queryText = `select *
    from ${PG_DB}.${PG_SCHEMA}.${TABLE_TRANSER_ORDER_ITEM}
    where "trNumber" = $1;`
    const query = {
        text: queryText,
        value: [trNumber]
    }
    return query
}

function doResponse(context, statusCode, err) {
    const newError = {
        message: err.message || 'error'
    }
    const response = {
        statusCode: statusCode,
        body: JSON.stringify(newError)
    }
    context.succeed(response)
}


function getUsername(requestContext) {
    try {
        const claims = requestContext.authorizer.claims;
        const username = claims['cognito:username'];
        return username
    } catch (err) {
        console.log("getUsername:", err);
        return null;
    }
}

function buildExpressionByUsernameAndSystemCode(username, systemCode, tableName) {
    let params = {
        TableName: tableName,
        KeyConditionExpression: "#user = :u and #code = :c",
        ExpressionAttributeNames: {
            "#user": "username",
            "#code": "systemCode"
        },
        ExpressionAttributeValues: {
            ":u": username,
            ":c": systemCode
        }
    }

    return params
}

function buildRolePrivilegeExpression(roleKey, rolePrivilegeCode) {
    let params = {
        TableName: "RolePrivilege",
        KeyConditionExpression: "#rk = :r and #cc = :c ",
        FilterExpression: "#alw = :al",
        ExpressionAttributeNames: {
            "#rk": "roleKey",
            "#cc": "code",
            "#alw": "allow"
        },
        ExpressionAttributeValues: {
            ":r": roleKey,
            ":c": rolePrivilegeCode,
            ":al": 'Y'
        }
    };

    return params
}

async function getUserSession(username, systemCode) {
    console.log("getUserSession: ", username, systemCode);
    try {
        const user_session_query = await docClient.query(buildExpressionByUsernameAndSystemCode(username, systemCode, 'UserSession')).promise();
        console.log("UserSession: ", user_session_query);
        if (user_session_query.Count == 1) {
            if (user_session_query.Items[0] && user_session_query.Items[0].sessionProperty) {
                console.log("SessionProperty: ", user_session_query.Items[0].sessionProperty);
                return {
                    data: user_session_query.Items[0].sessionProperty,
                    error: null
                }
            } else {
                return {
                    data: null,
                    error: {
                        message: 'Warehouse not found.'
                    }
                }
            }
        } else {
            return {
                data: null,
                error: {
                    message: 'Username not found.'
                }
            }
        }
    } catch (err) {
        console.log(err);
        return {
            data: null,
            error: err
        }
    }
}

async function checkPermission(username, systemCode, rolePrivilegeCode) {
    console.log("checkPermission:", username, systemCode, rolePrivilegeCode);
    try {
        const user_role_query = await docClient.query(buildExpressionByUsernameAndSystemCode(username, systemCode, "UserRole")).promise();
        if (user_role_query.Count == 1) {
            if (user_role_query.Items[0] && user_role_query.Items[0].roleKey) {
                const roleKey = user_role_query.Items[0].roleKey
                try {
                    const privilege_query = await docClient.query(buildRolePrivilegeExpression(roleKey, rolePrivilegeCode)).promise();
                    if (privilege_query.Count == 1) {
                        return {
                            data: privilege_query.Items[0],
                            error: null
                        }
                    } else {
                        return {
                            data: null,
                            error: {
                                message: "Unauthorize user, " + username
                            }
                        }
                    }

                } catch (err) {
                    return {
                        data: null,
                        error: err
                    }
                }
            } else {
                return {
                    data: null,
                    error: {
                        message: "Unauthorize user, " + username
                    }
                }
            }
        } else {
            return {
                data: null,
                error: {
                    message: "Unauthorize user, " + username
                }
            }
        }
    } catch (err) {
        console.log(err);
        return {
            data: null,
            error: err
        }
    }
}