const { readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const configurationKeys = [
  "SHIPROCKET_EMAIL",
  "SHIPROCKET_PASSWORD",
  "SHIPROCKET_PICKUP_LOCATION",
];

function printHelp() {
  console.log(`Usage: npm run shiprocket:check -- [--pincode <6 digits>] [--weight <kg>]

Checks Shiprocket authentication, the configured pickup location, and prepaid rates.
Defaults to a 0.5 kg sample delivered to the pickup location's own pincode.
This is a diagnostic rate sample, not a checkout shipping charge.
Only authentication and read-only lookup requests are made; no shipment is booked.

Options:
  --pincode  Destination pincode for the rate sample.
  --weight   Positive parcel weight in kilograms (default: 0.5).
  --help     Show this help without loading credentials or making requests.`);
}

function parseArguments(argumentsList) {
  const options = { weightKg: 0.5 };
  const seen = new Set();
  for (let index = 0; index < argumentsList.length; index++) {
    const flag = argumentsList[index];
    if (!["--pincode", "--weight"].includes(flag) || seen.has(flag)) {
      throw new Error("Use --pincode and/or --weight once each. See --help.");
    }
    seen.add(flag);
    const value = argumentsList[++index];
    if (flag === "--pincode") {
      if (!value || !/^[1-9]\d{5}$/.test(value)) {
        throw new Error("Provide a valid six-digit destination pincode.");
      }
      options.deliveryPincode = value;
    } else {
      const weightKg = Number(value);
      if (!value || !Number.isFinite(weightKg) || weightKg <= 0) {
        throw new Error("Provide a positive, finite parcel weight in kilograms.");
      }
      options.weightKg = weightKg;
    }
  }
  return options;
}

function loadShiprocketModule() {
  const ts = require("typescript");
  const filename = path.join(projectRoot, "lib", "shiprocket.ts");
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const localRequire = createRequire(filename);
  const loadedModule = { exports: {} };
  // This CLI runs locally on Node, outside Next's server-component bundler.
  // Use the real integration and bypass only its server-only bundler marker.
  const requireForCli = (name) => name === "server-only" ? {} : localRequire(name);
  new Function("require", "module", "exports", "__filename", "__dirname", outputText)(
    requireForCli,
    loadedModule,
    loadedModule.exports,
    filename,
    path.dirname(filename),
  );
  return loadedModule.exports;
}

async function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.length === 1 && ["--help", "-h"].includes(argumentsList[0])) {
    printHelp();
    return;
  }

  let options;
  try {
    options = parseArguments(argumentsList);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const { loadEnvConfig } = require("@next/env");
  loadEnvConfig(projectRoot, process.env.NODE_ENV !== "production", {
    info() {},
    error() { throw new Error("Could not load the project's environment configuration."); },
  });
  let configurationComplete = true;
  for (const key of configurationKeys) {
    const configured = Boolean(process.env[key]?.trim());
    console.log(`${key}: ${configured ? "configured" : "missing"}`);
    configurationComplete &&= configured;
  }
  if (!configurationComplete) {
    console.error("Set the missing server-side values in your local environment, then rerun this check.");
    process.exitCode = 1;
    return;
  }

  const shiprocket = loadShiprocketModule();
  try {
    const pickupLocation = await shiprocket.getShiprocketPickupLocation();
    console.log("Authentication: successful.");
    console.log("Pickup location: matched the configured nickname.");
    const deliveryPincode = options.deliveryPincode ?? pickupLocation.pincode;
    const rates = await shiprocket.getShiprocketRates({
      deliveryPincode,
      weightKg: options.weightKg,
      cod: false,
    });
    console.log(`Sample: ${options.weightKg} kg prepaid, ${options.deliveryPincode ? "using the supplied destination" : "using the pickup pincode as the destination"}.`);
    console.log("This diagnostic sample is not a checkout shipping charge.");
    console.log(`Available couriers: ${rates.couriers.length}.`);
    if (rates.couriers.length > 0) {
      const amounts = rates.couriers.map((courier) => courier.rate);
      console.log(`Sample rate range: INR ${Math.min(...amounts).toFixed(2)}–${Math.max(...amounts).toFixed(2)}.`);
    } else {
      console.log("No couriers were returned for this sample. Try another destination with --pincode.");
    }
    console.log("No order, shipment, or pickup was created.");
  } catch (error) {
    if (error instanceof shiprocket.ShiprocketError) {
      const status = Number.isInteger(error.httpStatus) ? `, HTTP ${error.httpStatus}` : "";
      console.error(`Shiprocket check failed (${error.code}${status}): ${error.message}`);
    } else {
      console.error("The Shiprocket check could not complete. No provider response or credentials were logged.");
    }
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.error("The local Shiprocket checker could not start. Check dependencies and environment configuration.");
  process.exitCode = 1;
});
