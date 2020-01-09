const fs = require('fs');
const PDFDocument = require('pdfkit')

const companyAddress_y = 30
const companyAddress_height = 35
const company_tel_y = companyAddress_y + companyAddress_height
const taxpayer_y = company_tel_y + 15
const header_width = 180
const header_top_left_x = 395
const picking_top_left_x = 20
const picking_top_left_y = taxpayer_y + 15
const picking_header_height = 92
const linePickingWidth = 0.5
const wh_text_label_width = 60
const contact_text_height = 10
const title_space = 2
const picking_order_top_left_y = taxpayer_y + picking_header_height + 18
const column_1_width = 30
const column_2_width = 50
const column_3_width = 170
const column_4_width = 70
const column_5_width = 50
const column_6_width = 60
const column_7_width = 50
const column_8_width = 75
let picking_order_table_height = 450
const picking_order_table_width = 555
const default_font_size = 7
const num_order = 21
const max_num_order = 30


async function generatePickingOrderFilePDF(data, pathFile) {

    return new Promise(function (resolve, reject) {

        let file = fs.createWriteStream(pathFile)

        let doc = new PDFDocument({
            autoFirstPage: false,
            bufferPages: true
        })

        try {
            doc.pipe(file);

            const responsePickingOrderItems = data.items

            let i, j, temparray
            const chunk = max_num_order;
            let items_split = []
            for (i = 0, j = responsePickingOrderItems.length; i < j; i += chunk) {
                temparray = responsePickingOrderItems.slice(i, i + chunk);
                items_split.push(temparray)
            }

            // calculate page
            let pages = 1
            if (responsePickingOrderItems.length > num_order) {
                const new_items = responsePickingOrderItems.length - num_order
                pages = Math.ceil(new_items / max_num_order) + 1
            }

            // add page
            for (let i = 0; i < pages; i++) {
                doc.addPage({
                    size: [595, 841],
                    margins: {
                        top: 30,
                        bottom: 20,
                        left: 20,
                        right: 30
                    }
                })
            }

            // draw pdf
            doc.font('./resources/fonts/Prompt-Regular.ttf')
            doc.fontSize(default_font_size);
            const range = doc.bufferedPageRange(); // => { start: 0, count: 2 }
            for (i = range.start, end = range.start + range.count, range.start <= end; i < end; i++) {
                doc.switchToPage(i);
                generateHeader(doc, {})
                generatePickingContact(doc, data)
                generatePickingOrderTable(doc, items_split[i] || [])
                if (i === end - 1) {
                    generateResult(doc, {})
                }

            }

            doc.end()
            resolve({
                fileStatus: true,
                file: file
            })
        } catch (err) {
            console.log('generatePickingOrderFilePDF err => ', err)
            reject(err)
        }
    });





}


function generateHeader(doc, data) {

    // draw header line
    const header_top_left_y = 30
    const header_height = 50
    const lineWidth = 0.8
    doc.lineWidth(lineWidth)
    doc.lineJoin('round')
        .rect(header_top_left_x,
            header_top_left_y,
            header_width,
            header_height)
        .stroke();


    doc.image('resources/images/default_grCode.png', header_top_left_x - 60, header_top_left_y - 3, {
        fit: [header_height + 5, header_height + 5],
    });

    //draw header
    const header_th = 'ใบจัดของ'
    const header_en = 'Picking Order'
    doc.fontSize(9)
    doc.text(`${header_th}`, header_top_left_x, (header_top_left_y + 9), {
        align: 'center',
        width: header_width
    })
    doc.text(`${header_en}`, header_top_left_x, (header_top_left_y + 23), {
        align: 'center',
        width: header_width
    })
}



function generatePickingContact(doc, data) {
    // draw line picking contact
    const picking_header_width = 373
    doc.lineWidth(linePickingWidth)
    doc.lineJoin('round')
        .rect(picking_top_left_x,
            picking_top_left_y,
            picking_header_width,
            picking_header_height)
        .stroke();

    // draw header detail label
    const from_wh_label = 'From W/H :'
    const from_wh_label_x = picking_top_left_x + 7
    const from_wh_label_y = picking_top_left_y + 2
    const contact_label_text_options = {
        align: 'left',
        width: wh_text_label_width
    }
    doc.fontSize(default_font_size);
    doc.text(`${from_wh_label}`, from_wh_label_x, from_wh_label_y, contact_label_text_options)

    const wh_text_value_width = picking_header_width - 70
    // draw contact value
    const from_wh_value = data.fromWarehouseNameTH || data.fromWarehouseNameEN || ''
    const to_wh_value = data.toWarehouseNameTH || data.toWarehouseNameEN || ''

    const from_wh_value_x = wh_text_label_width + 10
    doc.text(`${from_wh_value}`, from_wh_value_x, from_wh_label_y, {
        align: 'left',
        width: wh_text_value_width
    })

    const to_wh_label = 'To W/H :'
    const to_wh_label_x = from_wh_label_x + 185
    doc.text(`${to_wh_label}`, to_wh_label_x, from_wh_label_y, {
        align: 'left',
        width: wh_text_value_width
    })

    const to_wh_value_x = to_wh_label_x + 50
    doc.text(`${to_wh_value}`, to_wh_value_x, from_wh_label_y, {
        align: 'left',
        width: wh_text_value_width
    })

    /*********************************************************/

    // draw line picking date
    const picking_date_top_left_x = header_top_left_x
    const picking_date_top_left_y = taxpayer_y + 15
    const picking_date_header_width = header_width
    const picking_date_header_height = picking_header_height

    doc.lineWidth(linePickingWidth)

    doc.lineJoin('round')
        .rect(picking_date_top_left_x,
            picking_date_top_left_y,
            picking_date_header_width,
            picking_date_header_height)
        .stroke();

    // draw picking date label
    const label_picking_date_th = 'วันที่ :'
    const label_picking_date_th_x = picking_date_top_left_x + 7
    const label_picking_date_th_y = picking_top_left_y + 2
    const contact_text_label_options = {
        align: 'left',
        width: wh_text_label_width
    }
    doc.fontSize(default_font_size);
    doc.text(`${label_picking_date_th}`, label_picking_date_th_x, label_picking_date_th_y, contact_text_label_options)
    const label_picking_date_en = 'Request Date :'
    const label_picking_date_en_y = label_picking_date_th_y + contact_text_height
    doc.text(`${label_picking_date_en}`, label_picking_date_th_x, label_picking_date_en_y, contact_text_label_options)

    const label_order_no_th = 'เลขที่'
    const label_order_no_th_y = label_picking_date_en_y + contact_text_height + title_space
    doc.text(`${label_order_no_th}`, label_picking_date_th_x, label_order_no_th_y, contact_text_label_options)
    const label_order_no_en = 'Order No.'
    const label_order_no_en_y = label_order_no_th_y + contact_text_height
    doc.text(`${label_order_no_en}`, label_picking_date_th_x, label_order_no_en_y, contact_text_label_options)


    // draw picking date value
    let date = ''
    if (data.transactionDate) {
        const d = new Date(data.transactionDate);
        date = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()
    }
    const value_picking_date = date || ''
    const value_order_no_th = data.trNumber || ''

    const picking_date_value_width = 100
    const value_picking_date_x = label_picking_date_th_x + 55
    const value_picking_date_y = label_picking_date_th_y
    const picking_date_value_text_options = {
        align: 'left',
        width: picking_date_value_width
    }
    doc.text(`${value_picking_date}`, value_picking_date_x, value_picking_date_y, picking_date_value_text_options)
    const value_order_no_th_y = label_picking_date_en_y + contact_text_height + title_space
    doc.text(`${value_order_no_th}`, value_picking_date_x, value_order_no_th_y, picking_date_value_text_options)


}



function generatePickingOrderTable(doc, data) {

    picking_order_table_height = 450

    doc.lineWidth(linePickingWidth)
    const table_header_height = 25
    // table header
    doc.lineJoin('round')
        .rect(picking_top_left_x,
            picking_order_top_left_y,
            picking_order_table_width,
            table_header_height)
        .stroke();


    // title column 1
    const column_1_x = picking_top_left_x + column_1_width
    const title_column_1_th = 'ลำดับ'
    const title_column_1_en = 'No.'
    const title_column_1_y = picking_order_top_left_y + 2
    doc.fontSize(default_font_size);
    doc.text(`${title_column_1_th}`, picking_top_left_x, title_column_1_y, {
        align: 'center',
        width: column_1_width
    }).text(`${title_column_1_en}`, {
        align: 'center',
        width: column_1_width
    })


    const column_2_x = column_1_x + column_2_width
    const title_column_2_th = 'รหัสสินค้า'
    const title_column_2_en = 'Item Code'
    doc.text(`${title_column_2_th}`, column_1_x, title_column_1_y, {
        align: 'center',
        width: column_2_width
    }).text(`${title_column_2_en}`, {
        align: 'center',
        width: column_2_width
    })


    const column_3_x = column_2_x + column_3_width
    const title_column_3_th = 'รายละเอียด'
    const title_column_3_en = 'Item Description'
    doc.text(`${title_column_3_th}`, column_2_x, title_column_1_y, {
        align: 'center',
        width: column_3_width
    }).text(`${title_column_3_en}`, {
        align: 'center',
        width: column_3_width
    })


    const column_4_x = column_3_x + column_4_width
    const title_column_4_th = '-'
    const title_column_4_en = 'Bin Location'
    doc.text(`${title_column_4_th}`, column_3_x, title_column_1_y, {
        align: 'center',
        width: column_4_width
    }).text(`${title_column_4_en}`, {
        align: 'center',
        width: column_4_width
    })


    const column_5_x = column_4_x + column_5_width
    const title_column_5_th = 'หน่วย'
    const title_column_5_en = 'Unit'
    doc.text(`${title_column_5_th}`, column_4_x, title_column_1_y, {
        align: 'center',
        width: column_5_width
    }).text(`${title_column_5_en}`, {
        align: 'center',
        width: column_5_width
    })

    const column_6_x = column_5_x + column_6_width
    const title_column_6_th = 'วันหมดอายุใกล้สุด'
    const title_column_6_en = '-'
    doc.text(`${title_column_6_th}`, column_5_x, title_column_1_y, {
        align: 'center',
        width: column_6_width
    }).text(`${title_column_6_en}`, {
        align: 'center',
        width: column_6_width
    })

    const column_7_x = column_6_x + column_7_width
    const title_column_7_th = 'จำนวน'
    const title_column_7_en = 'Picking'
    doc.text(`${title_column_7_th}`, column_6_x, title_column_1_y, {
        align: 'center',
        width: column_7_width
    }).text(`${title_column_7_en}`, {
        align: 'center',
        width: column_7_width
    })

    const title_column_8_th = 'จำนวน'
    const title_column_8_en = 'Picking จริง'
    doc.text(`${title_column_8_th}`, column_7_x, title_column_1_y, {
        align: 'center',
        width: column_8_width
    }).text(`${title_column_8_en}`, {
        align: 'center',
        width: column_8_width
    })


    let order_y = picking_order_top_left_y + table_header_height + 3

    for (let i = 0; i < data.length; i++) {

        const seq = data[i].seq || ''
        const itemCode = data[i].productItemCode || ''
        const itemDescription = data[i].productItemNameTH || data[i].productItemNameEN || ''
        const binLocation = data[i].binLocation || ''
        const unit = data[i].unitNameTH || data[i].unitNameEN || ''

        let nearestExpiredDate = '-'
        if (data[i].nearestExpiredDate != null && data[i].nearestExpiredDate != '') {
            const dateTimeStamp = Date.parse(data[i].nearestExpiredDate);
            const d = new Date(dateTimeStamp);
            nearestExpiredDate = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()

        }
        const expireDate = nearestExpiredDate
        const picking = data[i].pickingQuantity >= 0 ? data[i].pickingQuantity : ''


        doc.text(`${seq}`, picking_top_left_x, order_y, {
            align: 'center',
            width: column_1_width
        })
        doc.text(`${itemCode}`, column_1_x, order_y, {
            align: 'center',
            width: column_2_width
        })
        doc.text(`${itemDescription}`, column_2_x + 5, order_y, {
            align: 'left',
            width: column_3_width - 10
        })

        doc.text(`${binLocation}`, column_3_x + 5, order_y, {
            align: 'center',
            width: column_4_width - 10
        })

        doc.text(`${unit}`, column_4_x + 5, order_y, {
            align: 'center',
            width: column_5_width - 10
        })

        doc.text(`${expireDate}`, column_5_x + 5, order_y, {
            align: 'center',
            width: column_6_width - 10
        })

        doc.text(`${picking}`, column_6_x + 5, order_y, {
            align: 'center',
            width: column_7_width - 10
        })

        doc.moveTo(column_7_x + 5, order_y + 12)
            .lineTo((column_7_x + 5) + (column_8_width - 10), order_y + 12)
            .stroke()

        order_y += 20

        if (i > num_order - 1) {
            picking_order_table_height += 20
        }
    }

    //  draw table
    doc.lineJoin('round')
        .rect(picking_top_left_x,
            picking_order_top_left_y,
            picking_order_table_width,
            picking_order_table_height)
        .stroke();

    // column 1
    const column_height = picking_order_top_left_y + picking_order_table_height
    doc.moveTo(column_1_x, picking_order_top_left_y)
        .lineTo(column_1_x, column_height)
        .stroke()

    // column 2
    doc.moveTo(column_2_x, picking_order_top_left_y)
        .lineTo(column_2_x, column_height)
        .stroke()

    // column 3
    doc.moveTo(column_3_x, picking_order_top_left_y)
        .lineTo(column_3_x, column_height)
        .stroke()

    // column 4
    doc.moveTo(column_4_x, picking_order_top_left_y)
        .lineTo(column_4_x, column_height)
        .stroke()

    // column 5
    doc.moveTo(column_5_x, picking_order_top_left_y)
        .lineTo(column_5_x, column_height)
        .stroke()

    // column 6
    doc.moveTo(column_6_x, picking_order_top_left_y)
        .lineTo(column_6_x, column_height)
        .stroke()

    // column 7
    doc.moveTo(column_7_x, picking_order_top_left_y)
        .lineTo(column_7_x, column_height)
        .stroke()


}

function generateResult(doc, data) {

    const picking_order_table_amount_y = picking_order_top_left_y + picking_order_table_height
    const picking_order_table_amount_height = 80

    doc.lineJoin('round')
        .rect(picking_top_left_x,
            picking_order_table_amount_y,
            picking_order_table_width,
            picking_order_table_amount_height)
        .stroke();
    doc.lineWidth(linePickingWidth)

    const note = 'หมายเหตุ : '
    doc.text(`${note}`, picking_top_left_x + 5, picking_order_table_amount_y + 5, {
        align: 'left',
        width: picking_order_table_width - column_5_width - column_6_width - column_7_width - 10
    })

    const signature_array = [
        {
            title: 'ผู้จัด/ Picked'
        },
        {
            title: 'ผู้ตรวจสอบ / Checked By'
        },
        {
            title: 'ผู้บันทึกลงระบบ / Recorded By'
        }
    ]
    const signature_y = picking_order_table_amount_y + picking_order_table_amount_height + 5
    const signature_width = 138
    const signature_height = 90
    const signature_space = 0.75
    const sigature_fill = '..................................................................................................'
    const sigature_fill_date = 'วันที่ / Date......................................................................'
    let signature_x = picking_top_left_x

    signature_array.forEach(item => {

        doc.lineJoin('round')
            .rect(signature_x,
                signature_y,
                signature_width,
                signature_height)
            .stroke();
        const signature_label = item.title || ''
        const signature_label_x = signature_x + 5
        const signature_label_y = signature_y + 5
        const signature_label_text_options = {
            align: 'left',
            width: signature_width - 10
        }
        const sigature_fill_y = signature_y + signature_height - 30
        const sigature_fill_date_y = signature_y + signature_height - 15
        doc.text(`${signature_label}`, signature_label_x, signature_label_y, signature_label_text_options)
        doc.text(`${sigature_fill}`, signature_label_x, sigature_fill_y, signature_label_text_options)
        doc.text(`${sigature_fill_date}`, signature_label_x, sigature_fill_date_y, signature_label_text_options)

        signature_x += (signature_width + signature_space)
    })

}

module.exports = {
    generatePickingOrderFilePDF
}