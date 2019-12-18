const drawPickingOrderPDF = require('./drawPickingOrderPDF')
const AWS = require('aws-sdk')
const s3 = new AWS.S3();
const fs = require('fs');

async function genFilePDFAndUploadPDF(data) {

    return new Promise(function (resolve, reject) {

        console.log('start genFilePDFAndUploadPDF');

        const fileName = `pickingOrder_${data.trNumber}.pdf`
        const pathFile = `/tmp/${fileName}`

        drawPickingOrderPDF.generatePickingOrderFilePDF(data, pathFile).then(({ fileStatus, file }) => {
            if (fileStatus === true) {
                file.on("finish", function () {
                    //get the file size
                    const stats = fs.statSync(pathFile);
                    console.log("starting s3 putObject");
                    s3.upload({
                        Bucket: "test.import.excel",
                        Key: fileName,
                        Body: fs.createReadStream(pathFile),
                        ContentType: "application/pdf",
                        ContentLength: stats.size,
                    }, function (err, data) {
                        if (err) {
                            console.log('upload error');
                            reject(err)
                        } else {
                            resolve(data)
                        }
                    });
                });

            } else {
                // do nothing
                console.log('generateFilePDF error ')
                reject({ message: 'generateFilePDF error' })
            }
        }).catch(err => {
            // do nothing
            console.log('generateFilePDF error => ', err)
            reject(err)
        })
    })

}


module.exports = {
    genFilePDFAndUploadPDF
}