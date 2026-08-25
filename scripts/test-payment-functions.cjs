const createPayment = require("C:/Users/HP/Desktop/NewProjet/Retrouveobjet/netlify/functions/create-payment.js");
const verifyPayment = require("C:/Users/HP/Desktop/NewProjet/Retrouveobjet/netlify/functions/verify-payment.js");
const withdraw = require("C:/Users/HP/Desktop/NewProjet/Retrouveobjet/netlify/functions/withdraw.js");
const webhook = require("C:/Users/HP/Desktop/NewProjet/Retrouveobjet/netlify/functions/webhook.js");
const withdrawHook = require("C:/Users/HP/Desktop/NewProjet/Retrouveobjet/netlify/functions/withdraw-hook.js");

(async () => {
  let r;

  r = await createPayment.handler({ httpMethod: "OPTIONS" });
  console.log("create-payment OPTIONS:", r.statusCode);

  r = await createPayment.handler({ httpMethod: "POST", body: "{}" });
  console.log("create-payment sans champs:", r.statusCode, r.body);

  r = await verifyPayment.handler({
    httpMethod: "GET",
    queryStringParameters: { token: "test-token-inexistant-123" },
  });
  console.log("verify-payment faux token:", r.statusCode, r.body.slice(0, 200));

  r = await verifyPayment.handler({ httpMethod: "GET", queryStringParameters: {} });
  console.log("verify-payment sans token:", r.statusCode, r.body);

  r = await withdraw.handler({ httpMethod: "POST", body: "{}" });
  console.log("withdraw sans champs:", r.statusCode, r.body);

  r = await webhook.handler({ httpMethod: "POST", body: "{}" });
  console.log("webhook sans tokenPay:", r.statusCode, r.body);

  r = await withdrawHook.handler({ httpMethod: "POST", body: "{}" });
  console.log("withdraw-hook sans tokenPay:", r.statusCode, r.body);
})().catch((e) => { console.error("ECHEC:", e.message); process.exit(1); });
