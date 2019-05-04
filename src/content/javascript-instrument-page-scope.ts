// Code below is not a content script: no Firefox APIs should be used
// Also, no webpack/es6 imports may be used in this file since the script
// is exported as a page script as a string

export const pageScript = function({
  jsInstruments,
  // instrumentFingerprintingApis,
}) {
  // messages the injected script
  function sendMessagesToLogger($event_id, messages) {
    document.dispatchEvent(
      new CustomEvent($event_id, {
        detail: messages,
      }),
    );
  }

  const event_id = document.currentScript.getAttribute("data-event-id");

  const {
    instrumentObject,
    // instrumentObjectProperty,
  } = jsInstruments(
    event_id,
    sendMessagesToLogger,
  );

  const testing =
    document.currentScript.getAttribute("data-testing") === "true";
  if (testing) {
    console.log("OpenWPM: Currently testing");
    (window as any).instrumentObject = instrumentObject;
  }

  /**
   * Prebid.js
   */

  // Wait for window.pbjs to be available
  const prebidJsAvailable = new Promise(function (resolve) {
    const now = Date.now();
      function check() {
        if (typeof (window as any).pbjs !== "undefined") {
          return resolve();
        } else {
          // Keep checking for 10 seconds
          if (Date.now() - now < 10000) {
            setTimeout(check, 10);
          } else {
            console.log("Stopped checking for Prebid.js loading on this page (10s have passed)");
          }
        }
      }
      check();
    });

  prebidJsAvailable.then(function () {
    console.log("Prebid.js available - instrumenting...");
    instrumentObject(
      (window as any).pbjs,
      "pbjs",
      {},
    );
  });

  // TODO instrument prebid.js events
  //

  /*
   * Start Instrumentation
   */
  // TODO: user should be able to choose what to instrument

  // instrumentFingerprintingApis({ instrumentObjectProperty, instrumentObject });

  if (testing) {
    console.log(
      "OpenWPM: Content-side javascript instrumentation started",
      new Date().toISOString(),
    );
  }
};
