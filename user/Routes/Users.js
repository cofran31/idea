'use strict';

var express = require('express');
var users = express.Router();
var database = require('../Database/database');
//Lib JWT
var cors = require('cors')
var jwt = require('jsonwebtoken');
//Generate LOGS
const log4js = require('log4js');
log4js.configure({
    appenders: {user: {type: 'file', filename: 'logs/user.log'}},
    categories: {default: {appenders: ['user'], level: 'info'}}
});
const logger = log4js.getLogger('user');
var token;
users.use(cors());
process.env.SECRET_KEY = "carlitos2018";
//Canal para el envio de la cola 
var amqpClient = require('./amqpClient');
let channel;
amqpClient.createClient({url: 'amqp://gbpvggyb:geW9bhqoC9HDgohaWcPXLp1gS2CapKPQ@eagle.rmq.cloudamqp.com/gbpvggyb'})
        .then(ch => {
            channel = ch;
        });

// Nuevo Usuario
users.post('/new', function (req, res) {
    var today = new Date();
    var jsonData = {
        "error": 1,
        "data": ""
    };
    var userData = {
        "first_name": req.body.first_name,
        "last_name": req.body.last_name,
        "email": req.body.email,
        "password": req.body.password,
        "created": today,
        "tipo_users": "u"
    }
    database.connection.getConnection(function (err, connection) {
        if (err) {
            jsonData["error"] = 1;
            jsonData["data"] = "Error interno de servidor";
            logger.info('ERROR AL CONECTAR AL SERVIDOR [ERROR]');
            res.status(500).json(jsonData);
        } else {
            connection.query('INSERT INTO users SET ?', userData, function (err, rows, fields) {
                if (!err) {
                    jsonData.error = 0;
                    jsonData["data"] = "Usuario registrado exitosamente!";
                    logger.info('USUARIO CREADO EXITOSAMENTE U: [' + userData['email'] + '] S: [SUCCESS]');
                    res.status(201).json(jsonData);
                } else {
                    jsonData["data"] = "No se pudo crear el usuario!";
                    logger.info('ERROR AL CREAR EL USUARIO U: [' + userData['email'] + '] S: [ERROR]');
                    res.status(400).json(jsonData);
                }
            });
            connection.release();
        }
    });
});
// Verificacion usuario
users.post('/login', function (req, res) {
    var jsonData = {};
    var email = req.body.email;
    var password = req.body.password;
    database.connection.getConnection(function (err, connection) {
        if (err) {
            jsonData["error"] = 1;
            jsonData["data"] = "Error interno de servidor!";
            logger.info('ERROR AL CONECTAR AL SERVIDOR [ERROR]');
            res.status(500).json(jsonData);
        } else {
            connection.query('SELECT * FROM users WHERE email = ?', [email], function (err, rows, fields) {
                if (err) {
                    jsonData.error = 1;
                    jsonData["data"] = "Error interno de servidor!";
                    logger.info('ERROR AL CONECTAR AL SERVIDOR [ERROR]');
                    res.status(400).json(jsonData);
                } else {
                    if (rows.length > 0) {
                        if (rows[0].password == password) {
                            token = jwt.sign(rows[0], process.env.SECRET_KEY, {
                                expiresIn: 86400  // un dia de validez
                            });
                            jsonData.error = 0;
                            jsonData["token"] = token;
                            logger.info('USUARIO REGISTRADO LOGIN U: [' + email + '] S: [SUCCESS]');
                            res.status(200).json(jsonData);
                        } else {
                            jsonData.error = 1;
                            jsonData["data"] = "Su email o Password no coinciden!";
                            logger.info('USUARIO & PASSWORD INCORRECTO LOGIN U: [' + email + '] S: [ERROR]');
                            res.status(400).json(jsonData);
                        }
                    } else {
                        jsonData.error = 1;
                        jsonData["data"] = "Email incorrecto!";
                        logger.info('EMAIL INCORRECTO LOGIN U: [' + email + '] S: [ERROR]');
                        res.status(400).json(jsonData);
                    }
                }
            });
            connection.release();
        }
    });
});
// Verificacion del token middleware
users.use(function (req, res, next) {
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
// Se obtienen todos los usuarios SOLO PARA ADMINISTRADORES 
users.get('/getUsers', function (req, res) {
    var jsonData = {};
    var token = req.body.token || req.headers['token'];
    var decoded = jwt.decode(token, process.env.SECRET_KEY);
    var login = decoded['email'];
    database.connection.getConnection(function (err, connection) {
        if (err) {
            jsonData["error"] = 1;
            jsonData["data"] = "Error interno de servidor";
            res.status(500).json(jsonData);
        } else {
            connection.query('SELECT id,first_name,last_name,email,tipo_users FROM users', function (err, rows, fields) {
                if (!err) {
                    jsonData["error"] = 0;
                    jsonData["data"] = rows;
                    logger.info('SE OBTIENE REGISTROS DE USUARIOS CORRECTAMENTE: LOGIN U: [' + login + '][SUCCESS]');
                    res.status(200).json(jsonData);
                } else {
                    jsonData["data"] = "No hay datos";
                    logger.info('ERROR AL OBTENER REGISTROS DE USUARIOS: LOGIN U: [' + login + '][ERROR]');
                    res.status(400).json(jsonData);
                }
            });
            connection.release();
        }
    });
});
// Se obtienen todos los usuarios
users.delete('/delete/:id', function (req, res) {
    var jsonData = {};
    var token = req.body.token || req.headers['token'];
    var decoded = jwt.decode(token, process.env.SECRET_KEY);
    var login = decoded['email'];
    var id_users = decoded['id_user'];
    var idDelete = req.params.id;
    database.connection.getConnection(function (err, connection) {
        if (err) {
            jsonData["error"] = 1;
            jsonData["data"] = "Error interno de servidor";
            res.status(500).json(jsonData);
        } else {
            connection.query('DELETE FROM users WHERE id = ?', [idDelete], function (err, result) {
                if (!err) {
                    jsonData["error"] = 0;
                    jsonData["data"] = "Usuario Eliminado Correctamente";
                    logger.info('REGISTRO ELIMINADO CORRECTAMENTE: LOGIN U: [' + login + '][SUCCESS]');
                    var id_u = req.params.id;
                    amqpClient.sendRPCMessage(channel, id_u, 'USERS')
                            .then(msg => {
                                // const result = JSON.parse(msg.toString());
                                // res.status(200).json(result);
                            });
                    res.status(200).json(jsonData);
                } else {
                    jsonData["data"] = "No hay datos";
                    logger.info('ERROR AL ELIMINAR REGISTRO DE USUARIO: LOGIN U: [' + login + '][ERROR]');
                    res.status(400).json(jsonData);
                }
            });
            connection.release();
        }
    });
});
// Se obtienen todos los usuarios
users.put('/update/:id', function (req, res) {
    var jsonData = {};
    var decoded = jwt.decode(token, process.env.SECRET_KEY);
    var login = decoded['email'];
    var idUser = req.params.id;
    var first_name = req.body.first_name;
    var last_name = req.body.last_name;
    var email = req.body.email;
    var password = req.body.password;
    var tipo_users = req.body.tipo_users;
    database.connection.getConnection(function (err, connection) {
        if (err) {
            jsonData["error"] = 1;
            jsonData["data"] = "Error interno de servidor";
            res.status(500).json(jsonData);
        } else {
            connection.query('UPDATE users SET first_name = ? , last_name = ? , email = ? , password = ? , tipo_users = ? WHERE id = ?', [first_name, last_name, email, password, tipo_users, idUser], function (err, result) {
                if (!err) {
                    jsonData["error"] = 0;
                    jsonData["data"] = "Usuario Modificado exitosamente!";
                    logger.info('REGISTRO ACTUALIZADO CORRECTAMENTE: LOGIN U: [' + login + '][SUCCESS]');
                    res.status(200).json(jsonData);
                } else {
                    jsonData["data"] = "Error al momento de actualizar usuario";
                    logger.info('ERROR AL ACTUALIZAR REGISTRO DE USUARIO: LOGIN U: [' + login + '][ERROR]');
                    res.status(400).json(jsonData);
                }
            });
            connection.release();
        }
    });
});

module.exports = users;