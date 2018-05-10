var express = require('express');
var ideas = express.Router();
var database = require('../Database/database');
//Lib JWT
var cors = require('cors')
var jwt = require('jsonwebtoken');
//Generate LOGS
const log4js = require('log4js');
log4js.configure({
    appenders: {idea: {type: 'file', filename: 'logs/idea.log'}},
    categories: {default: {appenders: ['idea'], level: 'info'}}
});
const logger = log4js.getLogger('idea');
var token;
ideas.use(cors());
process.env.SECRET_KEY = "carlitos2018";
//Canal para el envio de la cola 
var amqpClient = require('./amqpClient');
let channel;
amqpClient.createClient({url: 'amqp://gbpvggyb:geW9bhqoC9HDgohaWcPXLp1gS2CapKPQ@eagle.rmq.cloudamqp.com/gbpvggyb'})
        .then(ch => {
            channel = ch;
        });

// Nueva Idea
ideas.post('/newIdea', function (req, res) {
    var token = req.body.token || req.headers['token'];
    var count;
    var jsonData = {
        "error": 1,
        "data": ""
    };
    var decoded = jwt.decode(token, process.env.SECRET_KEY);
    var id_user = decoded['id'];
    var nombre = decoded['first_name'];
    var apellidos = decoded['last_name'];
    var login = decoded['email'];
    var userData = {
        "id_user": id_user,
        "full_name": nombre + ' ' + apellidos,
        "title_idea": req.body.title_idea,
        "content_idea": req.body.content_idea,
        "votos": 0,
    }
    database.connection.getConnection(function (err, connection) {
        if (err) {
            jsonData["error"] = 1;
            jsonData["data"] = "Error interno de servidor";
            logger.info('ERROR AL CONECTAR AL SERVIDOR [ERROR]');
            res.status(500).json(jsonData);
        } else {
            // connection.query('SELECT count(*) AS namesCount FROM ideas WHERE id_user = ?', [id_user], function (err, rows, fields) {
            // count = rows[0].namesCount;
            //Valido para que solo un usuario agrege una idea
            // if (count === 0) {
            connection.query('INSERT INTO ideas SET ?', userData, function (err, rows, fields) {
                if (!err) {
                    jsonData.error = 0;
                    jsonData["data"] = "Idea registrado exitosamente!";
                    logger.info('IDEA REGISTRADA EXITOSAMENTE U: [' + login + '] S: [SUCCESS]');
                    res.status(201).json(jsonData);
                } else {
                    jsonData["data"] = "No se pudo crear la Idea!";
                    jsonData["token"] = err;
                    logger.info('ERROR AL CREAR LA IDEA U: [' + login + '] S: [ERROR]');
                    res.status(400).json(jsonData);
                }
            });
            //  } else {
            //     jsonData["error"] = 1;
            //     jsonData["data"] = "El usuario ya tiene una idea registrada!!!";
            //     logger.info('ERROR AL CREAR LA IDEA EL USUARIO YA REGISTRO U: [' + login + '] S: [ERROR]');
            //      res.status(500).json(jsonData);
            // }
            connection.release();
            //});
        }

    });
});
// Verificacion del token middleware
ideas.use(function (req, res, next) {
    var token = req.body.token || req.headers['token'];
    var email = req.body.email;
    var jsonData = {};
    if (token) {
        jwt.verify(token, process.env.SECRET_KEY, function (err) {
            if (err) {
                jsonData["error"] = 1;
                jsonData["data"] = "El Token es invalido";
                logger.info('TOKEN INVALIDO! LOGIN U: [' + email + '] S: [ERROR]');
                res.status(500).json(jsonData);
            } else {
                next();
            }
        });
    } else {
        jsonData["error"] = 1;
        jsonData["data"] = "Please send a token";
        logger.info('TOKEN INVALIDO! LOGIN U: [' + email + '] S: [ERROR]');
        res.status(403).json(jsonData);
    }
});
// Todas las ideas
ideas.get('/getIdeas', function (req, res) {
    var jsonData = {};
    var jsonIdeas = {};
    var jsonIdea = [];
    var token = req.body.token || req.headers['token'];
    var decoded = jwt.decode(token, process.env.SECRET_KEY);
    var login = decoded['email'];
    var id_user_token = decoded['id'];
    var id_user;
    database.connection.getConnection(function (err, connection) {
        if (err) {
            jsonData["error"] = 1;
            jsonData["data"] = "Error interno de servidor";
            res.status(500).json(jsonData);
        } else {
            connection.query('SELECT * FROM ideas', function (err, rows, fields) {
                if (!err) {
                    jsonIdeas["error"] = 0;
                    jsonIdea.push(jsonIdeas);
                    for (var i = 0; i < rows.length; i++) {
                        id_user = rows[i].id_user;
                        if (id_user === id_user_token) {
                            jsonIdeas = {
                                id: rows[i].id,
                                id_user: rows[i].id_user,
                                full_name: rows[i].full_name,
                                title_idea: rows[i].title_idea,
                                content_idea: rows[i].content_idea,
                                votos: rows[i].votos,
                                eliminar: rows[i].id,
                            }
                        } else {
                            jsonIdeas = {
                                id: rows[i].id,
                                id_user: rows[i].id_user,
                                full_name: rows[i].full_name,
                                title_idea: rows[i].title_idea,
                                content_idea: rows[i].content_idea,
                                votos: rows[i].votos,
                            }
                        }

                        jsonIdea.push(jsonIdeas);
                    }
                    logger.info('SE OBTIENE REGISTROS DE IDEAS CORRECTAMENTE: LOGIN U: [' + login + '][SUCCESS]');
                    res.status(200).json(jsonIdea);
                } else {
                    jsonData["data"] = "No hay datos";
                    logger.info('ERROR AL OBTENER REGISTROS DE IDEAS: LOGIN U: [' + login + '][ERROR]');
                    res.status(400).json(jsonData);
                }
            });
            connection.release();
        }
    }
    );
});
// Eliminar Idea
ideas.delete('/deleteIdea/:id', function (req, res) {
    var jsonData = {};
    var token = req.body.token || req.headers['token'];
    var decoded = jwt.decode(token, process.env.SECRET_KEY);
    var login = decoded['email'];
    var id_user_token = decoded['id'];
    var id_user_idea;
    var idDelete = req.params.id;
    database.connection.getConnection(function (err, connection) {
        if (err) {
            jsonData["error"] = 1;
            jsonData["data"] = "Error interno de servidor";
            res.status(500).json(jsonData);
        } else {
            connection.query('SELECT count(*) as existe FROM ideas WHERE id = ?', [idDelete], function (err, rows, fields) {
                var valido_existencia_idea = rows[0].existe;
                if (valido_existencia_idea > 0) {
                    connection.query('SELECT id_user FROM ideas WHERE id = ?', [idDelete], function (err, rows, fields) {
                        id_user_idea = rows[0].id_user;
                        if (id_user_idea === id_user_token) {
                            connection.query('DELETE FROM ideas WHERE id = ? AND id_user = ?', [idDelete, id_user_token], function (err, result) {
                                if (!err) {
                                    jsonData["error"] = 0;
                                    jsonData["data"] = "Idea y Votaciones Eliminados Correctamente";
                                    logger.info('REGISTRO DE IDEA ELIMINADO CORRECTAMENTE: LOGIN U: [' + login + '][SUCCESS]');
                                    connection.query('DELETE FROM voto WHERE id_ideas = ?', [idDelete], function (err, result) {
                                        logger.info('REGISTRO DE VOTO ELIMINADO CORRECTAMENTE: LOGIN U: [' + login + '][SUCCESS]');
                                    });
                                    res.status(200).json(jsonData);

                                } else {
                                    jsonData["error"] = 1;
                                    jsonData["data"] = "No hay datos";
                                    logger.info('ERROR AL ELIMINAR REGISTRO DE USUARIO: LOGIN U: [' + login + '][ERROR]');
                                    res.status(400).json(jsonData);
                                }
                            });
                        } else {
                            jsonData["error"] = 1;
                            jsonData["data"] = "Error usted no puede eliminar Ideas de otro usuario";
                            logger.info('ERROR AL ELIMINAR REGISTRO DE IDEA DE OTRO USUARIO: LOGIN U: [' + login + '][ERROR]');
                            res.status(400).json(jsonData);
                        }
                    });
                } else {
                    jsonData["error"] = 1;
                    jsonData["data"] = "Error no existe la idea que desea eliminar";
                    logger.info('ERROR NO EXITE LA IDEA QUE DESEA ELIMINAR: LOGIN U: [' + login + '][ERROR]');
                    res.status(400).json(jsonData);
                }
            });
        }
        connection.release();
    });
});
// Votar por una idea
ideas.post('/insertVotos', function (req, res) {
    var jsonData = {};
    var token = req.body.token || req.headers['token'];
    var decoded = jwt.decode(token, process.env.SECRET_KEY);
    var login = decoded['email'];
    var id_usuario = decoded['id'];
    var id_idea = req.body.id;
    var voto = req.body.voto;
    database.connection.getConnection(function (err, connection) {
        if (err) {
            jsonData["error"] = 1;
            jsonData["data"] = "Error interno de servidor";
            res.status(500).json(jsonData);
        } else {
            var userData = {
                "id_user": id_usuario,
                "id_ideas": id_idea,
            }
            connection.query('INSERT INTO voto SET ?', userData, function (err, rows, fields) {
                if (!err) {
                    jsonData["error"] = 0;
                    jsonData["data"] = "Voto Registrado Correctamente!";
                    logger.info('REGISTRO LA VOTACION CORRECTAMENTE: LOGIN U: [' + login + '][SUCCESS]');
                    var id_u = req.body.id;
                    amqpClient.sendRPCMessage(channel, id_u, 'VOTOS')
                            .then(msg => {
                                // const result = JSON.parse(msg.toString());
                                // res.status(200).json(result);
                            });
                    res.status(200).json(jsonData);
                } else {
                    jsonData["data"] = "Error al momento de VOTAR";
                    logger.info('ERROR AL VOTAR: LOGIN U: [' + login + '][ERROR]');
                    res.status(400).json(err);
                }
            });
            connection.release();
        }
    });
});
module.exports = ideas;

