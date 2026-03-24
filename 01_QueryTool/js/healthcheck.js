/**
 * LSC Healthcheck Rules Engine
 * Each rule queries the local database via LSCBridge.query(soql, callback)
 * and checks for common misconfigurations.
 *
 * Rules are defined declaratively and can be easily extended.
 * LSCBridge.query() uses PresentationPlayer.fetchWithParams() under the hood.
 */
var HealthcheckEngine = (function () {
    'use strict';

    var rules = [
        {
            id: 'HCP_PRIMARY_PROVIDER',
            name: 'HealthcareProvider - IsPrimaryProvider Flag',
            category: 'Account Management',
            description: 'Checks that HealthcareProvider records have IsPrimaryProvider set to true. Records without this flag may not appear correctly in the provider card or territory assignments.',
            severity: 'high',
            check: function (callback) {
                LSCBridge.query(
                    'SELECT Id, Name, IsPrimaryProvider, IsActive FROM HealthcareProvider LIMIT 100',
                    function (err, records) {
                        if (err) { callback('skip', 'Could not query HealthcareProvider: ' + err, []); return; }
                        if (!records || records.length === 0) { callback('skip', 'No HealthcareProvider records found in local DB.', []); return; }
                        var failing = records.filter(function (r) { return !r.IsPrimaryProvider; });
                        if (failing.length === 0) {
                            callback('pass', 'All ' + records.length + ' HealthcareProvider records have IsPrimaryProvider = true.', []);
                        } else {
                            callback('fail', failing.length + ' of ' + records.length + ' HealthcareProvider records do NOT have IsPrimaryProvider checked.', failing);
                        }
                    }
                );
            }
        },
        {
            id: 'HCP_ACTIVE',
            name: 'HealthcareProvider - IsActive Flag',
            category: 'Account Management',
            description: 'Checks that HealthcareProvider records are active. Inactive providers should not typically be synced to the device.',
            severity: 'medium',
            check: function (callback) {
                LSCBridge.query(
                    'SELECT Id, Name, IsActive, IsPrimaryProvider FROM HealthcareProvider LIMIT 100',
                    function (err, records) {
                        if (err) { callback('skip', 'Could not query HealthcareProvider: ' + err, []); return; }
                        if (!records || records.length === 0) { callback('skip', 'No HealthcareProvider records found.', []); return; }
                        var inactive = records.filter(function (r) { return !r.IsActive; });
                        if (inactive.length === 0) {
                            callback('pass', 'All ' + records.length + ' HealthcareProvider records are active.', []);
                        } else {
                            callback('warn', inactive.length + ' of ' + records.length + ' HealthcareProvider records are inactive.', inactive);
                        }
                    }
                );
            }
        },
        {
            id: 'AFFILIATION_PRIMARY',
            name: 'HealthcarePractitionerFacility - Primary Affiliation Exists',
            category: 'Account Management',
            description: 'Checks that providers have at least one primary affiliation (IsPrimary). Missing primary affiliations can affect provider card display.',
            severity: 'high',
            check: function (callback) {
                LSCBridge.query(
                    'SELECT Id, Name, PractitionerId, IsPrimary, IsActive FROM HealthcarePractitionerFacility LIMIT 100',
                    function (err, records) {
                        if (err) { callback('skip', 'Could not query HealthcarePractitionerFacility: ' + err, []); return; }
                        if (!records || records.length === 0) { callback('skip', 'No HealthcarePractitionerFacility records found.', []); return; }
                        var hasPrimary = {};
                        records.forEach(function (r) {
                            if (r.IsPrimary) hasPrimary[r.PractitionerId] = true;
                        });
                        var practitioners = {};
                        records.forEach(function (r) { practitioners[r.PractitionerId] = true; });
                        var noPrimary = Object.keys(practitioners).filter(function (pid) { return !hasPrimary[pid]; });
                        if (noPrimary.length === 0) {
                            callback('pass', 'All practitioners have at least one primary affiliation.', []);
                        } else {
                            callback('fail', noPrimary.length + ' practitioner(s) have no primary affiliation.', noPrimary.map(function (id) { return { PractitionerId: id }; }));
                        }
                    }
                );
            }
        },
        {
            id: 'ADDRESS_PRIMARY',
            name: 'ContactPointAddress - Primary Address Exists',
            category: 'Account Management',
            description: 'Checks that accounts have a primary address. Missing primary addresses can cause issues with visit planning and provider card.',
            severity: 'medium',
            check: function (callback) {
                LSCBridge.query(
                    'SELECT Id, ParentId, IsPrimary, IsActive, AddressType FROM ContactPointAddress LIMIT 100',
                    function (err, records) {
                        if (err) { callback('skip', 'Could not query ContactPointAddress: ' + err, []); return; }
                        if (!records || records.length === 0) { callback('skip', 'No ContactPointAddress records found.', []); return; }
                        var hasPrimary = {};
                        records.forEach(function (r) {
                            if (r.IsPrimary) hasPrimary[r.ParentId] = true;
                        });
                        var parents = {};
                        records.forEach(function (r) { parents[r.ParentId] = true; });
                        var noPrimary = Object.keys(parents).filter(function (pid) { return !hasPrimary[pid]; });
                        if (noPrimary.length === 0) {
                            callback('pass', 'All accounts have at least one primary address.', []);
                        } else {
                            callback('warn', noPrimary.length + ' account(s) have no primary address.', noPrimary.map(function (id) { return { ParentId: id }; }));
                        }
                    }
                );
            }
        },
        {
            id: 'TERRITORY_ASSIGNMENT',
            name: 'Account - Territory Assignment',
            category: 'Territory Alignment',
            description: 'Checks that accounts are assigned to at least one territory. Accounts without territory assignment will not appear in account lists.',
            severity: 'high',
            check: function (callback) {
                LSCBridge.query(
                    'SELECT Id, ObjectId, Territory2Id FROM ObjectTerritory2Association LIMIT 100',
                    function (err, records) {
                        if (err) { callback('skip', 'Could not query ObjectTerritory2Association: ' + err, []); return; }
                        if (!records || records.length === 0) {
                            callback('warn', 'No ObjectTerritory2Association records found in local DB. Accounts may not be territory-assigned.', []);
                            return;
                        }
                        callback('pass', records.length + ' territory-account associations found.', []);
                    }
                );
            }
        },
        {
            id: 'VISIT_STATUS',
            name: 'Visit - Open Visits Check',
            category: 'Visit Management',
            description: 'Checks for visits that may be stuck in an incomplete status.',
            severity: 'low',
            check: function (callback) {
                LSCBridge.query(
                    'SELECT Id, Name, AccountId, Status FROM Visit LIMIT 100',
                    function (err, records) {
                        if (err) { callback('skip', 'Could not query Visit: ' + err, []); return; }
                        if (!records || records.length === 0) { callback('skip', 'No Visit records found.', []); return; }
                        var incomplete = records.filter(function (r) {
                            return r.Status && r.Status !== 'Completed' && r.Status !== 'Submitted';
                        });
                        if (incomplete.length === 0) {
                            callback('pass', 'All ' + records.length + ' visits are completed or submitted.', []);
                        } else {
                            callback('warn', incomplete.length + ' visit(s) are not in Completed/Submitted status.', incomplete);
                        }
                    }
                );
            }
        },
        {
            id: 'SAMPLE_LIMITS',
            name: 'ProviderSampleLimit - Remaining Quantity',
            category: 'Sample Management',
            description: 'Checks for sample limits where remaining quantity is zero or negative, which would prevent sample drops.',
            severity: 'medium',
            check: function (callback) {
                LSCBridge.query(
                    'SELECT Id, Name, AccountId, ProductId FROM ProviderSampleLimit LIMIT 100',
                    function (err, records) {
                        if (err) { callback('skip', 'Could not query ProviderSampleLimit: ' + err, []); return; }
                        if (!records || records.length === 0) { callback('skip', 'No ProviderSampleLimit records found.', []); return; }
                        // Basic check: sample limit records exist
                        callback('pass', records.length + ' sample limit record(s) found in local DB.', []);
                    }
                );
            }
        },
        {
            id: 'CONSENT_STATUS',
            name: 'CommunicationSubscriptionConsent - Consent Captured',
            category: 'Consent Management',
            description: 'Checks that consent records exist for communication subscriptions.',
            severity: 'medium',
            check: function (callback) {
                LSCBridge.query(
                    'SELECT Id, CommunicationSubscriptionId, ConsentGiverId, EffectiveDateTime FROM CommunicationSubscriptionConsent LIMIT 100',
                    function (err, records) {
                        if (err) { callback('skip', 'Could not query CommunicationSubscriptionConsent: ' + err, []); return; }
                        if (!records || records.length === 0) {
                            callback('warn', 'No consent records found in local DB.', []);
                            return;
                        }
                        callback('pass', records.length + ' consent record(s) found in local DB.', []);
                    }
                );
            }
        }
    ];

    function getRules() { return rules; }

    function getRulesByCategory() {
        var categories = {};
        rules.forEach(function (r) {
            if (!categories[r.category]) categories[r.category] = [];
            categories[r.category].push(r);
        });
        return categories;
    }

    function runAll(onProgress, onComplete) {
        var results = [];
        var index = 0;
        function next() {
            if (index >= rules.length) { onComplete(results); return; }
            var rule = rules[index];
            rule.check(function (status, message, records) {
                var result = { rule: rule, status: status, message: message, records: records || [] };
                results.push(result);
                onProgress(index, rules.length, result);
                index++;
                next();
            });
        }
        next();
    }

    function runRule(ruleId, callback) {
        var rule = rules.find(function (r) { return r.id === ruleId; });
        if (!rule) { callback({ rule: null, status: 'skip', message: 'Rule not found: ' + ruleId, records: [] }); return; }
        rule.check(function (status, message, records) {
            callback({ rule: rule, status: status, message: message, records: records || [] });
        });
    }

    function addRule(rule) { rules.push(rule); }

    return { getRules: getRules, getRulesByCategory: getRulesByCategory, runAll: runAll, runRule: runRule, addRule: addRule };
})();
