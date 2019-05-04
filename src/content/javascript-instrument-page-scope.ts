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
    logCall,
  } = jsInstruments(event_id, sendMessagesToLogger);

  const testing =
    document.currentScript.getAttribute("data-testing") === "true";
  if (testing) {
    console.log("OpenWPM: Currently testing");
    (window as any).instrumentObject = instrumentObject;
  }

  /**
   * Prebid.js
   */
  const waitUntil = evaluator => {
    return new Promise(function(resolve) {
      const now = Date.now();
      /**
       * Note: Since best practice for scripts consuming Prebid.js is
       * to set up an window.pbjs object and window.pbjs.que array even
       * before pbjs loads, we can't simply wait for window.pbjs,
       * but instead wait for window.pbjs.onEvent, which only gets set
       * once Prebid.js has loaded.
       */
      function check() {
        if (evaluator()) {
          return resolve();
        } else {
          // Keep checking for 10 seconds
          if (Date.now() - now < 10000) {
            setTimeout(check, 10);
          } else {
            console.log(
              "Stopped checking for Prebid.js loading in a frame (10s have passed)",
            );
          }
        }
      }
      check();
    });
  };

  /**
   * Helper functions to wait for Prebid.js to be available
   *
   * Note: Since best practice for scripts consuming Prebid.js is
   * to set up an window.pbjs object and window.pbjs.que array even
   * before pbjs loads, we can't simply wait for window.pbjs,
   * but instead wait for window.pbjs.onEvent, which only gets set
   * once Prebid.js has loaded.
   */
  const prebidJsPlaceholderAvailable = waitUntil(
    () => typeof (window as any).pbjs !== "undefined",
  );
  const prebidJsAvailable = waitUntil(
    () =>
      typeof (window as any).pbjs !== "undefined" &&
      typeof (window as any).pbjs.onEvent !== "undefined",
  );

  let currentlyInstrumentedPbjsVersion;
  prebidJsPlaceholderAvailable.then(function() {
    console.log("Prebid.js placeholder available - instrumenting...");
    currentlyInstrumentedPbjsVersion =
      (window as any).pbjs.version !== undefined
        ? String((window as any).pbjs.version)
        : "placeholder";
    // Instrument access to object properties and functions
    const objectName = "pbjs<" + currentlyInstrumentedPbjsVersion + ">";
    instrumentObject((window as any).pbjs, objectName, {});
  });
  prebidJsAvailable.then(function() {
    if (currentlyInstrumentedPbjsVersion === (window as any).pbjs.version) {
      return;
    }
    console.log(
      "Prebid.js loaded and different from what we previously instrumenting - instrumenting anew...",
    );
    currentlyInstrumentedPbjsVersion = (window as any).pbjs.version;
    const objectName = "pbjs<" + currentlyInstrumentedPbjsVersion + ">";

    // Instrument events (Hack, since OpenWPM does not support instrumentation of events currently)
    const instrumentPrebidJsEvent = eventReference => {
      const handler = event => {
        // console.log("Prebid.js event", { eventReference, event }, arguments);
        /*
        Most don't, but some events contains some information about it's call context:
        canonicalUrl: undefined​​​
        numIframes: ​​​0
        reachedTop: true
        referer: "http://localtest.me:8000/test_pages/prebidjs.html"​​
        stack: (1) […]​​​​
        0: "http://localtest.me:8000/test_pages/prebidjs.html"
        length: 1
        */
        const refererInfo =
          event.refererInfo && event.refererInfo.referer
            ? event.refererInfo.referer
            : null;
        const canonicalUrl = event.canonicalUrl
          ? event.refererInfo.canonicalUrl
          : null;
        const callContext = {
          scriptUrl:
            refererInfo !== null
              ? refererInfo
              : canonicalUrl !== null
              ? canonicalUrl
              : "",
          scriptLine: "",
          scriptCol: "",
          funcName: "",
          scriptLocEval: "",
          callStack: "",
        };
        try {
          logCall(
            "event:" + objectName + ":" + eventReference,
            [event],
            callContext,
            {},
          );
        } catch (err) {
          console.log(
            "Error occurred when handling event: ",
            err.message,
            err.stack,
          );
        }
      };
      (window as any).pbjs.onEvent(eventReference, handler);
    };
    [
      "auctionInit",
      "auctionEnd",
      "bidAdjustment",
      "bidTimeout",
      "bidRequested",
      "bidResponse",
      "bidWon",
      "setTargeting",
      "requestBids",
      "addAdUnits",
      "adRenderFailed",
      "bidderDone",
    ].map(instrumentPrebidJsEvent);

    // Instrument access to object properties and functions
    instrumentObject((window as any).pbjs, objectName, {});
  });

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
