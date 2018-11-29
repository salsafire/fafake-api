const ipc = require('node-ipc');
const { Select } = require('enquirer');
// import Queue = require('promise-queue');
//
//
// const queue = new Queue();
// var Radio = require('prompt-radio');
import fs = require('fs');

const loopIndex = new Map<string, number>();

ipc.config.retry = 1500;
ipc.config.silent = true;
ipc.connectTo(
    'world',
    function () {
        ipc.of.world.on(
            'request-a-response',
            async function (request: any) {

                try {
                    let response: any;
                    if (!request.header['x-fake-api-host']) {
                        throw new Error('You must give a "x-fake-api-host" header');
                    }
                    const host = request.header['x-fake-api-host'];

                    switch (request.header['x-fake-mode']) {
                        case 'interactive':
                            response = await interactiveResponse(host, request);
                            break;

                        case 'loop':
                            response = await loopResponse(host, request);
                            break;

                        case 'explicit':
                            response = await explicitResponse(host, request);
                            break;
                    }

                    ipc.of.world.emit(`response-of-request-${request.id}`, { response });
                } catch (e) {
                    ipc.of.world.emit(`response-of-request-${request.id}`, {
                        error: {
                            mesage: e.message,
                            stack: e.stack
                        }
                    });
                }
            }
        );
    }
);

//

async function interactiveResponse(host, request) {
    const dir = __dirname + '/../response/' + host + request.url;
    let files = fs.readdirSync(dir);


    const prompt = new Select({
        name: 'Api response',
        message: 'Pick a response',
        choices: files
    });

    const answer = await prompt.run();

    return JSON.parse(fs.readFileSync(dir + '/' + answer).toString());
}


function loopResponse(host, request: any) {
    const currentIndex = loopIndex.get(request.url) || 0;

    const dir = __dirname + '/../response/' + host + request.url;
    let files = fs.readdirSync(dir);

    const answer = files[currentIndex % files.length];

    loopIndex.set(request.url, currentIndex + 1);

    return JSON.parse(fs.readFileSync(dir + '/' + answer).toString());
}

function explicitResponse(host, request: any) {
    if (!request.header['x-fake-api-explicit-file']) {
        throw new Error('"x-fake-api-explicit-file" header must be set');
    }

    const answer = request.header['x-fake-api-explicit-file'];
    const dir = __dirname + '/../response/' + host + request.url;
    return JSON.parse(fs.readFileSync(dir + '/' + answer).toString());
}




