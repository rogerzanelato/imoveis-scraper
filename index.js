const jsonpath = require('jsonpath');

const bjeto = {
    teste: 25,
    bola: {
        valor: '25'
    }
};

console.log(jsonpath.value(bjeto, 'teste'));