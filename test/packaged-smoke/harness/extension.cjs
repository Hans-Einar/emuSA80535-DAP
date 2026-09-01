"use strict";

function activate() {
  // The harness test runner owns the smoke. This extension only gives VS Code
  // a development-extension root from which to load that runner.
}

function deactivate() {}

module.exports = { activate, deactivate };
