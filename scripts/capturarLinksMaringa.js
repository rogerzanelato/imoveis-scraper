const fs = require('fs');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const Iconv = require('iconv').Iconv;
const iconvFromIsoToUf8 = new Iconv('iso-8859-1', 'utf8');
const moment = require("moment");
const argv = require("yargs");

const args = argv.option('valorinicial', {
    type: 'number',
    description: 'Valor inicial dos apartamentos',
    default: 300
  })
  .option('valorfinal', {
    type: 'number',
    description: 'Valor final dos apartamentos',
    default: 3000
  })
  .option('tipo', {
    choices: ['locacao', 'venda'],
    description: 'Tipo de apartamento sendo filtrado',
    default: "locacao"
  })
  .option('tipo_locacao', {
    description: 'Tipo de Locação',
    default: "APARTAMENTOS"
  })
  .option('regiao', {
    description: 'Regiao',
    default: "44"
  })
  .option('estado', {
    description: 'Estado',
    default: "PR"
  })
  .option('cidade', {
    type:'number',
    description: 'Cidade Numero',
    default: 10 //default maringá
  })
  .help()
  .argv;

(async function () {
    try {
        console.log("Capturando total de páginas.. ");
        const totalPages = await getTotalPages();
    
        console.log(`Iniciando WebScrapping dos Links.. (${totalPages} páginas)`);
        console.time("TempoWebScrapping");

        const linksImoveis = [];
        for (let currentPage = 0; currentPage <= totalPages; currentPage++) {
            const htmlListagemDeApartamentos = await getHtmlAtPage(currentPage);
            const linksImoveisScrapped = scrapLinksFromPage(htmlListagemDeApartamentos);
            linksImoveis.push(...linksImoveisScrapped);
        }
        
        console.timeEnd("TempoWebScrapping");

        console.log(`Salvando ${linksImoveis.length} links..`);
        await saveLinksIntoTxtFile(linksImoveis);
    } catch (err) {
        console.log("Falhou!", err);
    }
})();

/**
 * Faz um GET à pagina inicial da sub100 e retorna o total de páginas para consultar
 */
async function getTotalPages() {
    const result = await getHtmlAtPage(0);
    const $ = cheerio.load(result);
    const regex = /Página 1 de (\d*)/gm;
    const paginacaoText = $(".resultados_paginacao_descricao").text();
    const matches = regex.exec(paginacaoText);

    if (!matches)
        return null;

    return parseInt(matches[1]);
}

/**
 * Faz um GET à uma página de numero específico e retorna seu HTML convertido para UTF-8
 * @param {int} pageNumber 
 */
async function getHtmlAtPage(pageNumber) {
    return fetch(buildUrl(pageNumber), {
        method: 'GET',
        headers: {
           'Cookie': `sub100_lista=resumo; gettipo=${args.tipo_locacao}; getregiao=${args.regiao}; getestado=${args.estado}; getnegocio=${args.tipo}; getcidade=${args.cidade}`
        },
        redirect: 'follow'
    })
    .then(res => res.arrayBuffer())
    .then(arrayBuffer => iconvFromIsoToUf8.convert(Buffer.from(arrayBuffer), 'utf-8').toString())
}

/**
 * Monta a URL da Sub100
 * @param {int} pageNumber 
 */
function buildUrl(pageNumber) {
    return `http://www.sub100.com.br/imoveis/${args.tipo}/${args.tipo_locacao}/10-maringa-pr/de-r$${args.valorinicial}-ate-r$${args.valorfinal}/regiao-${args.regiao}/sub100list-resumo/pag-${pageNumber}/lista-10`;
}

/**
 * Recebe uma string contendo o HTML da página de listagem, e extraí os links de imóvel
 * @param {string} htmlListagemDeApartamentos
 */
function scrapLinksFromPage(htmlListagemDeApartamentos) {
    const imoveisList = [];
    const $ = cheerio.load(htmlListagemDeApartamentos);

    $(".link_botao").each(function () {
        const imovelPath = $(this).attr("href");
        imoveisList.push("http://www.sub100.com.br" + imovelPath);
    });

    return imoveisList;
}

/**
 * Recebe um array com os links, e salva num arquivo .txt separado por quebra de linha
 * @param {array} links 
 */
async function saveLinksIntoTxtFile(links) {
    const currentDateString = moment().format("YYYYMMDD_HHmm");
    const filePath = `./linkImoveisScrapped_sub100_${currentDateString}.txt`;
    
    const writeFile = (fileStream, link) => new Promise((resolve, reject) => {
        fileStream.write(`${link}\n`, err => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        })
    });

    const stream = fs.createWriteStream(filePath);
    const promises = links.map(link => writeFile(stream, link));

    return Promise.all(promises);
}