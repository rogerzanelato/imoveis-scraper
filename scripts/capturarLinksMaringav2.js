const fs = require('fs').promises;
const fetch = require('node-fetch');
const moment = require("moment");
const { delay } = require('../lib/helpers');
const queryString = require('query-string');

(async function () {
    try {
        console.log('Iniciando consulta de imóveis..')

        console.time("TempoWebScrapping");
        const linksImoveis = await getAllImoveisLinksRecursive();
        console.timeEnd("TempoWebScrapping");

        console.log(`Salvando ${linksImoveis.length} links..`);

        console.time("TempoSaveFile");
        await saveLinksIntoTxtFile(linksImoveis);
        console.time("TempoSaveFile");
    } catch (err) {
        console.log("Falhou!", err);
    }
})();

async function getAllImoveisLinksRecursive(currentPage = 1) {
    const result = await getImoveisPaginado(currentPage);
    const links = result.data.map((imovel) => `https://beta-api.sub100.com.br/api/properties/reference/${imovel.reference}?business_type=9e867846-fb2b-491e-954d-bbe68a1b88eb&complements=1&details=1`);
    
    console.log(`Percentual concluído: ${result.meta.current_page}/${result.meta.last_page}`);

    if (result.meta.current_page !== result.meta.last_page) {
        await delay(250);
        const linksNextPage = await getAllImoveisLinksRecursive(currentPage + 1);
        links.push(...linksNextPage);
    }

    return links;
}

function getImoveisPaginado(page) {
    const options = {
        method: 'GET',
        headers: {
            'accept': 'application/json',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'origin': 'https://sub100.com.br',
            'pragma': 'no-cache',
            'referer': 'https://sub100.com.br/'
        },
        redirect: 'follow'
    }

    const params = {
        business_type: '9e867846-fb2b-491e-954d-bbe68a1b88eb',
        city: 'e430c297-02f1-42b6-ae35-57b8d94b499a',
        type: '9321def4-9c0f-4088-a9c8-4cf5e5fb3643',
        subtype: '1fd8e4f7-722c-453b-91b4-508f095312b7',
        value: JSON.stringify({"min":600,"max":1000}),
        dorms: JSON.stringify({"suites":null,"dorms":3}),
        keyword: null,
        condo_value: JSON.stringify({"min":"","max":""}),
        installmentValues: JSON.stringify({"min":"","max":""}),
        publication_date: null,
        property_details: JSON.stringify({"details":[]}),
        condo_details: JSON.stringify({"details":[]}),
        dream_property: null,
        mcmv: null,
        academic_regions: null,
        environments: JSON.stringify({"environment":null}),
        total_area: JSON.stringify({"min":"","max":""}),
        private_area: JSON.stringify({"min":"","max":""}),
        land_area: JSON.stringify({"min":"","max":""}),
        advertiser: null,
        floors: JSON.stringify({"min":"","max":""}),
        pax: null,
        page: page,
        order: 'relevants',
    };

    const url = `https://beta-api.sub100.com.br/api/properties?${queryString.stringify(params)}`;
    
    return fetch(url, options).then((res) => res.json());
}

/**
 * Recebe um array com os links, e salva num arquivo .txt separado por quebra de linha
 * @param {array} links 
 */
async function saveLinksIntoTxtFile(links) {
    const currentDateString = moment().format("YYYYMMDD_HHmm");
    const filePath = `./linkImoveisScrapped_sub100_${currentDateString}.txt`;
    return fs.writeFile(filePath, links.join('\n'));
}
