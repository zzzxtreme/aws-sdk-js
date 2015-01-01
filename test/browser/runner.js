var webdriver = require('selenium-webdriver'),
    By = require('selenium-webdriver').By,
    until = require('selenium-webdriver').until,
    browsers = {
      firefox: require('selenium-webdriver/firefox'),
      chrome: require('selenium-webdriver/chrome'),
      phantomjs: require('selenium-webdriver/phantomjs')
    };

var driver, url;
if (process.env.CI && process.env.BROWSER) {
  var browser = process.env.BROWSER.split(':');
  var server = 'http://localhost:4445/wd/hub';
  var caps = new webdriver.Capabilities();
  caps.set('browserName', browser[0]);
  if (browser[1]) caps.set('version', browser[1]);
  if (browser[2]) caps.set('platform', browser[2]);
  caps.set('tunnel-identifier', process.env.TRAVIS_JOB_NUMBER);
  caps.set('name', 'Travis #' + process.env.TRAVIS_JOB_NUMBER);
  caps.set('build', process.env.TRAVIS_BUILD_NUMBER);
  driver = new webdriver.Builder().usingServer(server).withCapabilities({
    username: process.env.SAUCE_USERNAME,
    accessKey: process.env.SAUCE_ACCESS_KEY,
    browserName: browser[0],
    version: browser[1] || null,
    platform: browser[2] || null,
    build: process.env.TRAVIS_BUILD_NUMBER,
    name: 'Travis #' + process.env.TRAVIS_JOB_NUMBER,
    'tunnel-identifier': process.env.TRAVIS_JOB_NUMBER,
  }).build();

  // launch local server
  var connect = require('connect');
  var serveStatic = require('serve-static');
  connect().use(serveStatic(__dirname)).listen(9095);
  url = 'http://localhost:9095/runner.html';
} else {
  driver = new browsers[process.env.BROWSER || 'phantomjs'].Driver();
  url = 'file://' + __dirname + '/runner.html'
}

var index = 0, failed = 0;
function printStatus() {
  var script = 'return [jsApiReporter.finished, jsApiReporter.specs()]';
  driver.executeScript(script).then(function(result) {
    var isDone = result[0], items = result[1];
    for (; index < items.length; index++) {
      if (items[index] === 'pending') break;
      var item = '';
      switch (items[index].status) {
        case 'skipped': item = 'S'; break;
        case 'passed':  item = '.'; break;
        case 'failed':  failed++; item = 'X'; break;
      }
      process.stdout.write(item);
    }
    if (!isDone) setTimeout(printStatus, 10);
  });
}

driver.get(url);
printStatus();

var condition = until.elementLocated(By.css('.alert .bar'));
driver.wait(condition).then(function() {
  console.log('\n');
  driver.findElement({css: '.alert .bar'}).getText().then(console.log);
  driver.findElements({css: '.failures .spec-detail.failed'}).then(function(els) {
    console.log('\n');
    els.forEach(function(el, i) {
      el.findElement({css: '.description'}).getText().then(function(text) {
        console.log((i+1) + ') ' + text.replace(/\n/g, '') + '\n');
      });
      el.findElement({css: '.stack-trace'}).getText().then(function(text) {
        var lines = text.split('\n');
        var extra = lines.length > 6 ? '\n    ...' : '';
        console.log(lines.slice(0, 6).join('\n') + extra);
      });
    });
  });
});
driver.quit().then(function() { process.exit(failed); });
