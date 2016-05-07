var test = require('tap-only');
var proxyquire = require('proxyquire');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var path = require('path');
var sinon = require('sinon');
var noop = function () {};
var snyk = require('../');
var save = snyk.policy.save;

// spies
var policySaveSpy = sinon.spy();
var execSpy = sinon.spy();
var writeSpy = sinon.spy();

snyk.policy.save = function (data) {
  policySaveSpy(data);
  return Promise.resolve();
};

var wizard = proxyquire('../cli/commands/protect/wizard', {
  '../../../lib/npm': function (cmd) {
    execSpy(cmd);
    return Promise.resolve();
  },
  'then-fs': {
    writeFile: function (filename, body) {
      writeSpy(filename, body);
      return Promise.resolve();
    },
  },
  '../../../lib/protect': proxyquire('../lib/protect', {
    'then-fs': {
      writeFile: function (filename, body) {
        writeSpy(filename, body);
        return Promise.resolve();
      },
      createWriteStream: function () {
        // fake event emitter (sort of)
        return {
          on: noop,
          end: noop,
          removeListener: noop,
          emit: noop,
        };
      },
    },
    'fs': {
      statSync: function () {
        return true;
      }
    },
    './npm': function () {
      return Promise.resolve();
    },
    'child_process': {
      exec: function (a, b, callback) {
        callback(null, '', ''); // successful patch
      }
    }
  })
});


test('pre-tarred packages can be patched', function (t) {
  var answers = require(__dirname + '/fixtures/forever-answers.json');

  wizard.processAnswers(answers, {
    // policy
  }).then(function () {
    t.equal(policySaveSpy.callCount, 1, 'write functon was only called once');
    var vulns = Object.keys(policySaveSpy.args[0][0].patch);
    var expect = Object.keys(answers).filter(function (key) {
      return key.slice(0, 5) !== 'misc-';
    }).map(function (key) {
      return answers[key].vuln.id;
    });
    t.deepEqual(vulns, expect, 'two patches included');
  }).catch(t.threw).then(t.end);
});

test('process answers handles shrinkwrap', function (t) {
  t.plan(2);

  t.test('non-shrinkwrap package', function (t) {
    execSpy = sinon.spy();
    var answers = require(__dirname + '/fixtures/forever-answers.json');
    answers['misc-test-no-monitor'] = true;
    wizard.processAnswers(answers).then(function () {
      t.equal(execSpy.callCount, 0, 'shrinkwrap was not called');
    }).catch(t.threw).then(t.end);
  });

  t.test('shrinkwraped package', function (t) {
    execSpy = sinon.spy();
    var cwd = process.cwd();
    process.chdir(__dirname + '/fixtures/pkg-mean-io/');
    var answers = require(__dirname + '/fixtures/mean-answers.json');
    answers['misc-test-no-monitor'] = true;
    wizard.processAnswers(answers).then(function () {
      var shrinkCall = execSpy.getCall(1); // get the 2nd call (as the first is the install of snyk)
      t.equal(shrinkCall.args[0], 'shrinkwrap', 'shrinkwrap was called');
      process.chdir(cwd);
    }).catch(t.threw).then(t.end);

  });
});

test('wizard replaces npm\s default scripts.test', function (t) {
  var old = process.cwd();
  var dir = path.resolve(__dirname, 'fixtures', 'no-deps');
  writeSpy = sinon.spy(); // create a new spy
  process.chdir(dir);

  wizard.processAnswers({
    'misc-add-test': true,
    'misc-test-no-monitor': true,
  }).then(function () {
    t.equal(writeSpy.callCount, 1, 'package was written to');
    var pkg = JSON.parse(writeSpy.args[0][1]);
    t.equal(pkg.scripts.test, 'snyk test --dev', 'default npm exit 1 was replaced');
  }).catch(t.threw).then(function () {
    process.chdir(old);
    t.end();
  });
});

test('wizard replaces prepends to scripts.test', function (t) {
  var old = process.cwd();
  var dir = path.resolve(__dirname, 'fixtures', 'demo-os');
  var prevPkg = require(dir + '/package.json');
  writeSpy = sinon.spy(); // create a new spy
  process.chdir(dir);

  wizard.processAnswers({
    'misc-add-test': true,
    'misc-test-no-monitor': true,
  }).then(function () {
    t.equal(writeSpy.callCount, 1, 'package was written to');
    var pkg = JSON.parse(writeSpy.args[0][1]);
    t.equal(pkg.scripts.test, 'snyk test --dev && ' + prevPkg.scripts.test, 'prepended to test script');
  }).catch(t.threw).then(function () {
    process.chdir(old);
    t.end();
  });
});

test('wizard detects existing snyk in scripts.test', function (t) {
  var old = process.cwd();
  var dir = path.resolve(__dirname, 'fixtures', 'pkg-mean-io');
  var prevPkg = require(dir + '/package.json');
  writeSpy = sinon.spy(); // create a new spy
  process.chdir(dir);

  wizard.processAnswers({
    'misc-add-test': true,
    'misc-test-no-monitor': true,
  }).then(function () {
    t.equal(writeSpy.callCount, 1, 'package was written to');
    var pkg = JSON.parse(writeSpy.args[0][1]);
    t.equal(pkg.scripts.test, prevPkg.scripts.test, 'test script untouched');
  }).catch(t.threw).then(function () {
    process.chdir(old);
    t.end();
  });
});



test('teardown', function (t) {
  snyk.policy.save = save;
  t.pass('teardown complete');
  t.end();
});
