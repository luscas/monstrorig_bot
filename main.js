const path = require("path");
const axios = require("axios");
const TeleBot = require("telebot");

let TELEGRAM_BOT_TOKEN = process.env.API_KEY;

const toMhs = (hashes) => Number((hashes / 1000000).toFixed(2));

async function getStats2miners() {
  let { data: res } = await axios.get(
    "https://eth.2miners.com/api/accounts/nano_3fr9bmaj18dpdmrzimcg3z4psbdf7e1gwumc643pwpw6d97u33q5gzja56jx"
  );

  return {
    current_hashrate: (res.currentHashrate / 1e6).toFixed(2),
    payments: {
      balance: res.stats.balance / 10e8,
      paid: res.stats.paid / 10e8,
    },
    rewards: res.sumrewards,
    workers: res.workers,
    workersOffline: res.workersOffline,
    workersOnline: res.workersOnline,
  };
}

async function getStatsHiveon() {
  let { data: hashrates } = await axios.get(
    "https://hiveon.net/api/v1/stats/hashrates?minerAddress=1ad31a923af5ba1a6fdf3c180679cfa1ecd3f9d1&coin=ETH&window=10m&limit=144&offset=0&worker="
  );
  let { data: billing } = await axios.get(
    "https://hiveon.net/api/v1/stats/miner/1ad31a923af5ba1a6fdf3c180679cfa1ecd3f9d1/ETH/billing-acc"
  );
  let { data: currency } = await axios.get(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=brl,usd&include_24hr_change=true"
  );

  return {
    brl: {
      day: (currency.ethereum.brl * billing.expectedReward24H).toFixed(2),
      week: (currency.ethereum.brl * billing.expectedRewardWeek).toFixed(2),
      month: (currency.ethereum.brl * (billing.expectedReward24H * 30)).toFixed(
        2
      ),
      unpaid: (currency.ethereum.brl * billing.totalUnpaid).toFixed(2),
    },
    eth: {
      day: billing.expectedReward24H,
      week: billing.expectedRewardWeek,
      month: billing.expectedReward24H * 30,
      unpaid: billing.totalUnpaid,
    },
    hashrate: toMhs(hashrates.items[0].hashrate),
    mean: toMhs(hashrates.items[0].meanHashrate),
    reported: toMhs(hashrates.items[0].reportedHashrate),
    timestamp: hashrates.items[0].timestamp,
  };
}

const bot = new TeleBot({
  token: TELEGRAM_BOT_TOKEN,
  usePlugins: ["floodProtection", "commandButtons"],
  pluginFolder: path.join(__dirname, "./plugins/"),
});

bot.on(/^\/stats (.+)$/, async (msg, props) => {
  const text = props.match[1];

  if (text == "2miners") {
    let data = await getStats2miners();

    let text = `Hashrate atual: <b>${data.current_hashrate} mh's</b>
Pagamentos:
Balanço: <b>${data.payments.balance} eth</b>
Pago: <b>${data.payments.paid} eth</b>
--------------------------------------------------
Ganhos:
60 minutos: <b>${data.rewards[0].reward / 10e8} eth</b>
12 horas: <b>${data.rewards[1].reward / 10e8} eth</b>
24 horas: <b>${data.rewards[2].reward / 10e8} eth</b>
7 dias: <b>${data.rewards[3].reward / 10e8} eth</b>
30 dias: <b>${data.rewards[4].reward / 10e8} eth</b>`;

    return bot.sendMessage(msg.chat.id, text, {
      parseMode: "HTML",
      asReply: true,
    });
  } else if (text == "hiveon") {
    let data = await getStatsHiveon();

    let text = `Hashrate: <b>${data.hashrate} mh's</b> / <b>${data.mean} mh's</b> / <b>${data.reported} mh's</b> (Atual/Média/Reported)
Pagamentos:
<b>Dia ${data.brl.day} (${data.eth.day} eth)</b>
<b>Semana ${data.brl.week} (${data.eth.week} eth)</b>
<b>Mês ${data.brl.month} (${data.eth.month} eth)</b>
<b>Total a ser pago ${data.brl.unpaid} (${data.eth.unpaid} eth)</b>`;

    return bot.sendMessage(msg.chat.id, text, {
      parseMode: "HTML",
      asReply: true,
    });
  } else {
    return bot.sendMessage(msg.chat.id, "Esta pool está indisponível");
  }
});

bot.start();
