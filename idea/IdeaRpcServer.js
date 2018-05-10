'use strict';

var amqp = require('amqplib');

var q = 'USERS';
amqp.connect('amqp://gbpvggyb:geW9bhqoC9HDgohaWcPXLp1gS2CapKPQ@eagle.rmq.cloudamqp.com/gbpvggyb')
        .then(conn => {
            return conn.createChannel();
        })
        .then(ch => {
            ch.assertQueue(q, {durable: false});
            ch.prefetch(1);
            console.log(" [x] Esperando respuestas RPC");
            ch.consume(q, msg => {
                const n = parseInt(msg.content.toString());

                console.log(" [.] delete_DB_IDEA_VOTO id_users(%d)", n);

                // start
                let tStart = Date.now();

                let r = deleteDB(n);

                // finish
                let tEnd = Date.now();

                // to send object as a message,
                // you have to call JSON.stringify
                r = JSON.stringify({
                    result: r,
                    time: (tEnd - tStart)
                });

                ch.sendToQueue(msg.properties.replyTo,
                        new Buffer(r.toString()),
                        {correlationId: msg.properties.correlationId});
                ch.ack(msg);
            })
        });

function deleteDB(idDelete) {
    var error;
    var database = require('./Database/database');
    database.connection.getConnection(function (err, connection) {
        if (err) {
            error = "No se pudo conectar con la Base de Datos";
        } else {
            connection.query('DELETE FROM ideas WHERE id_user = ?', [idDelete], function (err, result) {
                connection.query('DELETE FROM voto WHERE id_user = ?', [idDelete], function (err, result) {
                });
            });
        }
        connection.release();
    });
    return 1;
}