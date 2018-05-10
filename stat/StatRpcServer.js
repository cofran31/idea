'use strict';

var amqp = require('amqplib');

var q = 'VOTOS';
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

                console.log(" [.] REFRESH_VOTOS_IDEA (%d)");

                // start
                let tStart = Date.now();

                let r = updateStat();

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

function updateStat() {
    var error;
    var id_idea;
    var count;
    var database = require('./Database/database');
    database.connection.getConnection(function (err, connection) {
        if (err) {
            error = "No se pudo conectar con la Base de Datos";
        } else {
            connection.query('SELECT * FROM ideas', function (err, rows, fields) {
                for (var i = 0; i < rows.length; i++) {
                    id_idea = rows[i].id;
                    connection.query('SELECT count(*) AS contador FROM voto WHERE id_ideas = ?', [id_idea], function (err, result, fields) {
                        count = result[0].contador;
                        console.log(count);
                        connection.query('UPDATE ideas SET votos = ? WHERE id = ?', [count, id_idea], function (err, result) {
                        });
                    });
                }
            });
        }
        connection.release();
    });
    return 1;
}