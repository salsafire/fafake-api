import Queue = require('promise-queue');

const Koa = require('koa');
const app = new Koa();
const http = require('http');
const ipc = require('node-ipc');
var bodyParser = require('koa-bodyparser');

ipc.config.id = 'world';
ipc.config.retry = 1500;
ipc.config.silent = false;
const sockets = new Set();

ipc.serve(
    function () {
        ipc.server.on('connect', (socket) => sockets.add(socket));
        ipc.server.on(
            'message',
            function (data, socket) {
                ipc.server.emit(
                    socket,
                    'message',  //this can be anything you want so long as
                    //your client knows.
                    data + ' world!'
                );
            }
        );
        ipc.server.on(
            'socket.disconnected',
            function (socket, destroyedSocketID) {
                sockets.delete(socket);
                ipc.log('client ' + destroyedSocketID + ' has disconnected!');
            }
        );
    }
);

ipc.server.start();

const queue = new Queue();


app.use(bodyParser());
app.use(async ctx => {
    ctx.set('Content-Type', 'application/json; charset=utf-8');

    let myResolve: (data) => void;
    let myReject: (data) => void;
    const waitForMyResolve = new Promise((resolve, reject) => {
        myResolve = resolve;
        myReject = reject;
    });

    const requestId = Math.random();
    sockets.forEach(socket => ipc.server.emit(socket, 'request-a-response', {
        id: `${requestId}`,
        method: ctx.request.method,
        url: ctx.request.url,
        body: ctx.request.body,
        header: ctx.request.header,
    }));

    ipc.server.on(
        `response-of-request-${requestId}`,
        function (data: { response?: any, error?: any }) {
            if (data.response) {
                myResolve(data.response);
            } else {
                myReject(data.error);
            }
        }
    );

    const response: any = await waitForMyResolve;
    ctx.status = response.statusCode;
    ctx.body = response.body;
    for (const key in response.headers) {
        ctx.set(key, response.headers[key]);
    }
});

http.createServer(app.callback()).listen(3000);