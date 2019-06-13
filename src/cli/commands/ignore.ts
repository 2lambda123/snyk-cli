module.exports = ignore;

import * as policy from 'snyk-policy';
import {apiTokenExists} from '../../lib/api-token';

import * as Debug from 'debug';
const debug = Debug('snyk');

function ignore(options) {
  debug('snyk ignore called with options: %O', options);

  apiTokenExists();

  if (!options.id) {
    throw Error('idRequired');
  }
  options.expiry = new Date(options.expiry);
  if (options.expiry.getTime() !== options.expiry.getTime()) {
    debug('No/invalid expiry given, using the default 30 days');
    options.expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  if (!options.reason) {
    options.reason = 'None Given';
  }

  debug(
    'changing policy: ignore "%s", for all paths, reason: "%s", until: %o',
    options.id, options.reason, options.expiry,
  );
  return policy.load(options['policy-path'])
    .catch((error) => {
      if (error.code === 'ENOENT') {    // file does not exist - create it
        return policy.create();
      }
      throw Error('policyFile');
    })
    .then(function ignoreIssue(pol) {
      pol.ignore[options.id] = [
        {
          '*':
            {
              reason: options.reason,
              expires: options.expiry,
            },
        },
      ];
      policy.save(pol, options['policy-path']);
    });
}
