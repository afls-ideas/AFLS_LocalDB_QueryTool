/**
 * LSC Local Database Bridge
 * Abstraction layer using PresentationPlayer.fetchWithParams()
 * Ref: https://help.salesforce.com/s/articleView?id=ind.lsc_presentation_player_functions.htm
 *
 * License: MIT (see repository LICENSE file).
 * Disclaimer: This code is provided "as is" for diagnostic use; use at your own risk.
 *
 * PresentationPlayer.fetchWithParams(query, params, callbackMethodName)
 *   - query: SOQL string or queryLocator for pagination
 *   - params: { batchSize: N } (max 100, default 15)
 *   - callbackMethodName: STRING name of a global function
 *   - Returns: { records, done, totalSize, queryLocator, state }
 *
 * When running outside the iPad, mock data is returned for desktop testing.
 */
var LSCBridge = (function () {
    'use strict';

    var _isOnDevice = false;
    var _callbackId = 0;
    var _configData = null;

    function init(configData) {
        _configData = configData || null;
        _isOnDevice = (typeof PresentationPlayer !== 'undefined' &&
                       typeof PresentationPlayer.fetchWithParams === 'function');
        return _isOnDevice;
    }

    function isOnDevice() {
        return _isOnDevice;
    }

    function getConfigData() {
        return _configData;
    }

    /**
     * Run a SOQL query against the local database.
     * Automatically paginates through all results using queryLocator.
     * @param {string} soql - Full SOQL query string
     * @param {function} callback - function(err, records, meta)
     *   meta: { totalSize, done }
     */
    function query(soql, callback) {
        if (!_isOnDevice) {
            var parsed = _parseSOQL(soql);
            if (parsed) {
                var mockRecords = _getMockData(parsed.object, parsed.fields, parsed.limit);
                callback(null, mockRecords, { totalSize: mockRecords.length, done: true });
            } else {
                callback('Could not parse query for mock data.', [], { totalSize: 0, done: true });
            }
            return;
        }

        var allRecords = [];
        _fetchPage(soql, allRecords, callback);
    }

    function _fetchPage(soqlOrLocator, allRecords, callback) {
        var cbName = _registerCallback(function (data) {
            if (!data || data.state === 'error') {
                var msg = data ? (data.message || 'Query error') : 'No response from PresentationPlayer';
                if (data && data.code) msg += ' (' + data.code + ')';
                callback(msg, allRecords, { totalSize: 0, done: true });
                return;
            }

            if (data.records && data.records.length > 0) {
                for (var i = 0; i < data.records.length; i++) {
                    allRecords.push(data.records[i]);
                }
            }

            if (data.done) {
                callback(null, allRecords, { totalSize: data.totalSize || allRecords.length, done: true });
            } else if (data.queryLocator) {
                _fetchPage(data.queryLocator, allRecords, callback);
            } else {
                callback(null, allRecords, { totalSize: data.totalSize || allRecords.length, done: true });
            }
        });

        try {
            PresentationPlayer.fetchWithParams(soqlOrLocator, { batchSize: 100 }, cbName);
        } catch (e) {
            callback('fetchWithParams error: ' + e.message, allRecords, { totalSize: 0, done: true });
        }
    }

    /**
     * Run a single-page query (no auto-pagination). Returns up to batchSize records.
     * @param {string} soql
     * @param {number} batchSize - Max 100
     * @param {function} callback - function(err, data)
     *   data: { records, done, totalSize, queryLocator, state }
     */
    function querySinglePage(soql, batchSize, callback) {
        if (!_isOnDevice) {
            var parsed = _parseSOQL(soql);
            var mockRecords = parsed ? _getMockData(parsed.object, parsed.fields, batchSize) : [];
            callback(null, { records: mockRecords, done: true, totalSize: mockRecords.length, queryLocator: null, state: 'success' });
            return;
        }

        var cbName = _registerCallback(function (data) {
            if (!data || data.state === 'error') {
                callback(data ? (data.message || 'Query error') : 'No response', data || {});
            } else {
                callback(null, data);
            }
        });

        try {
            PresentationPlayer.fetchWithParams(soql, { batchSize: Math.min(batchSize || 100, 100) }, cbName);
        } catch (e) {
            callback('fetchWithParams error: ' + e.message, {});
        }
    }

    /**
     * Continue fetching using a queryLocator from a previous call.
     * @param {string} queryLocator
     * @param {function} callback - function(err, data)
     */
    function fetchNext(queryLocator, callback) {
        if (!_isOnDevice) {
            callback(null, { records: [], done: true, totalSize: 0, queryLocator: null, state: 'success' });
            return;
        }

        var cbName = _registerCallback(function (data) {
            if (!data || data.state === 'error') {
                callback(data ? (data.message || 'Query error') : 'No response', data || {});
            } else {
                callback(null, data);
            }
        });

        try {
            PresentationPlayer.fetchWithParams(queryLocator, cbName);
        } catch (e) {
            callback('fetchWithParams error: ' + e.message, {});
        }
    }

    /**
     * Get list of known LSC objects (static list - no API to discover dynamically).
     */
    function getAvailableObjects() {
        // Comprehensive list of LSC / Health Cloud / standard objects.
        // Sorted alphabetically. Not all will exist in every org - if a
        // query fails, the object simply isn't available in the local DB.
        return [
            'Account',
            'AccountContactRelation',
            'AccountPlan',
            'AccountTerritory2Association',
            'AppAlert',
            'BusinessLicense',
            'CommunicationSubscription',
            'CommunicationSubscriptionConsent',
            'Contact',
            'ContactPointAddress',
            'ContactPointConsent',
            'ContactPointEmail',
            'ContactPointPhone',
            'DataUsePurpose',
            'Event',
            'GoalDefinition',
            'HealthcareProvider',
            'HealthcareProviderNpi',
            'HealthcareProviderSpecialty',
            'HealthcarePractitionerFacility',
            'IndividualVisit',
            'KamAccountPlan',
            'LifeSciMarketableProduct',
            'ObjectTerritory2Association',
            'Presentation',
            'PresentationPage',
            'Product2',
            'ProductItem',
            'ProviderActivityGoal',
            'ProviderSampleLimit',
            'RecordType',
            'SampleTransaction',
            'SampleTransactionItem',
            'Survey',
            'SurveyResponse',
            'SurveySubject',
            'Task',
            'Territory2',
            'Territory2Model',
            'TerritoryProdtQtyAllocation',
            'User',
            'UserTerritory2Association',
            'Visit',
            'VisitedProduct'
        ];
    }

    /**
     * Get known fields for a given object (static list).
     */
    function getObjectFields(objectName) {
        // Field lists are conservative - only confirmed/high-confidence fields.
        // Use the checkbox Object Browser to discover additional fields.
        var fieldMap = {
            // --- Standard Salesforce ---
            'Account': ['Id', 'Name', 'AccountNumber', 'Type', 'Phone', 'BillingCity', 'BillingState', 'IsPersonAccount', 'PersonContactId', 'RecordTypeId'],
            'AccountContactRelation': ['Id', 'AccountId', 'ContactId', 'Roles', 'IsActive', 'IsDirect'],
            'Contact': ['Id', 'Name', 'FirstName', 'LastName', 'Email', 'Phone', 'AccountId', 'MailingCity', 'MailingState'],
            'Event': ['Id', 'Subject', 'WhoId', 'WhatId', 'StartDateTime', 'EndDateTime', 'Location', 'OwnerId'],
            'Product2': ['Id', 'Name', 'ProductCode', 'IsActive', 'Family', 'Description'],
            'RecordType': ['Id', 'Name', 'SobjectType', 'IsActive', 'DeveloperName'],
            'Task': ['Id', 'Subject', 'WhoId', 'WhatId', 'Status', 'Priority', 'ActivityDate', 'OwnerId', 'Description'],
            'User': ['Id', 'Name', 'Username', 'Email', 'IsActive', 'ProfileId', 'UserRoleId'],
            // --- Health Cloud ---
            'BusinessLicense': ['Id', 'Name', 'AccountId', 'LicenseNumber', 'Status', 'IsActive', 'LicenseClass', 'IssueDate', 'PeriodStart', 'PeriodEnd', 'HealthcareProviderId', 'ContactId'],
            'HealthcareProvider': ['Id', 'Name', 'AccountId', 'IsPrimaryProvider', 'IsActive', 'PractitionerId'],
            'HealthcareProviderNpi': ['Id', 'Name', 'HealthcareProviderId', 'Npi', 'NpiType', 'IsActive', 'EffectiveFrom', 'EffectiveTo', 'AccountId', 'PractitionerId'],
            'HealthcareProviderSpecialty': ['Id', 'Name', 'HealthcareProviderId', 'IsPrimary'],
            'HealthcarePractitionerFacility': ['Id', 'Name', 'PractitionerId', 'AccountId', 'IsPrimary', 'IsActive'],
            // --- Contact Points ---
            'ContactPointAddress': ['Id', 'Name', 'ParentId', 'AddressType', 'Street', 'City', 'State', 'PostalCode', 'Country', 'IsPrimary', 'IsActive'],
            'ContactPointConsent': ['Id', 'Name', 'ContactPointId', 'DataUsePurposeId', 'PrivacyConsentStatus', 'EffectiveFrom', 'EffectiveTo', 'CaptureSource'],
            'ContactPointEmail': ['Id', 'Name', 'ParentId', 'EmailAddress', 'IsPrimary', 'IsActive'],
            'ContactPointPhone': ['Id', 'Name', 'ParentId', 'TelephoneNumber', 'IsPrimary', 'IsActive', 'PhoneType'],
            // --- Consent ---
            'CommunicationSubscription': ['Id', 'Name', 'ContactPointId', 'DataUsePurposeId'],
            'CommunicationSubscriptionConsent': ['Id', 'CommunicationSubscriptionId', 'ConsentGiverId', 'EffectiveDateTime'],
            'DataUsePurpose': ['Id', 'Name', 'Description', 'LegalBasis', 'IsActive', 'CanDataSubjectOptOut'],
            // --- Territory Management (standard ETM) ---
            'AccountTerritory2Association': ['Id', 'AccountId', 'Territory2Id'],
            'Territory2': ['Id', 'Name', 'Territory2TypeId', 'ParentTerritory2Id', 'Description'],
            'Territory2Model': ['Id', 'Name', 'State', 'Description', 'ActivatedDate'],
            'ObjectTerritory2Association': ['Id', 'ObjectId', 'Territory2Id', 'AssociationCause'],
            'UserTerritory2Association': ['Id', 'UserId', 'Territory2Id', 'RoleInTerritory2'],
            // --- Visits ---
            'IndividualVisit': ['Id', 'Name'],
            'Visit': ['Id', 'Name', 'AccountId', 'Status', 'PlannedStartDateTime', 'ActualVisitStartTime'],
            'VisitedProduct': ['Id', 'Name', 'VisitId', 'ProductId'],
            // --- IC / Presentations ---
            'Presentation': ['Id', 'Name', 'IsActive'],
            'PresentationPage': ['Id', 'Name', 'PresentationId'],
            // --- LSC Products ---
            'LifeSciMarketableProduct': ['Id', 'Name', 'ProductId', 'ProductCode', 'IsActive', 'Type', 'Description', 'StartDate', 'EndDate', 'ParentProductId', 'TherapeuticArea'],
            // --- Sample Management ---
            'ProductItem': ['Id', 'ProductItemNumber', 'Product2Id', 'QuantityOnHand', 'QuantityUnitOfMeasure', 'SerialNumber', 'LocationId'],
            'ProviderSampleLimit': ['Id', 'Name', 'AccountId', 'ProductId'],
            'SampleTransaction': ['Id', 'Name', 'AccountId', 'Status', 'OwnerId', 'RecordTypeId'],
            'SampleTransactionItem': ['Id', 'Name', 'SampleTransactionId', 'Product2Id', 'Quantity'],
            'TerritoryProdtQtyAllocation': ['Id', 'Name', 'TerritoryId', 'ProductId', 'AllocatedQuantity', 'RemainingQuantity', 'DebitedQuantity', 'AllocationType', 'TimePeriodId'],
            // --- Activity Plans ---
            'ProviderActivityGoal': ['Id', 'Name', 'AccountId', 'ActivityPlanId', 'OverallGoal', 'ProductLevelGoal', 'NonProductGoal', 'ActivityAttainmentPercentage', 'TotalActualActivityValue', 'TotalScheduledActivityValue'],
            // --- Key Account Management ---
            'AccountPlan': ['Id', 'Name', 'AccountId', 'Status', 'StartDate', 'EndDate', 'OwnerId', 'Notes', 'AccountVision', 'AccountStrategicPriorities'],
            'GoalDefinition': ['Id', 'Name', 'Description', 'Status', 'Type', 'Category', 'ScopeType', 'OwnerId', 'ParentGoalId', 'RecordTypeId'],
            'KamAccountPlan': ['Id', 'Name', 'AccountId', 'Status', 'StartDate', 'EndDate', 'OwnerId'],
            // --- Surveys ---
            'Survey': ['Id', 'Name', 'Description', 'ActiveVersionId'],
            'SurveyResponse': ['Id', 'Name', 'SurveyId', 'SurveyVersionId', 'Status', 'CompletedDateTime', 'SubmitterId'],
            'SurveySubject': ['Id', 'Name', 'SurveyResponseId', 'SubjectId', 'SubjectEntityType'],
            // --- Alerts ---
            'AppAlert': ['Id', 'Name', 'Subject', 'Message', 'Type', 'Severity', 'Source', 'EffectiveDate', 'ValidUntilDate', 'OwnerId']
        };
        return fieldMap[objectName] || ['Id', 'Name'];
    }

    // --- Internal helpers ---

    /**
     * Register a global callback function for PresentationPlayer.
     * Returns the global function name as a string.
     */
    function _registerCallback(fn) {
        _callbackId++;
        var name = '_lscBridgeCb_' + _callbackId;
        window[name] = function (data) {
            delete window[name]; // auto-cleanup
            fn(data);
        };
        return name;
    }

    function _parseSOQL(soql) {
        var match = soql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?\s*$/i);
        if (!match) return null;
        return {
            fields: match[1].split(',').map(function (f) { return f.trim(); }),
            object: match[2],
            where: match[3] || '',
            orderBy: match[4] || '',
            limit: match[5] ? parseInt(match[5], 10) : 100
        };
    }

    function _getMockData(objectName, fields, limit) {
        var mockRecords = [];
        var count = Math.min(limit || 5, 5);
        for (var i = 0; i < count; i++) {
            var record = {};
            for (var j = 0; j < fields.length; j++) {
                var f = fields[j];
                if (f === 'Id') {
                    record[f] = 'MOCK_' + objectName + '_' + (i + 1);
                } else if (f === 'Name') {
                    record[f] = objectName + ' Record ' + (i + 1);
                } else if (f === 'IsPrimaryProvider') {
                    record[f] = (i === 0);
                } else if (f.indexOf('Is') === 0 || f.indexOf('Has') === 0) {
                    record[f] = (i % 2 === 0);
                } else if (f.indexOf('Date') > -1 || f.indexOf('date') > -1) {
                    record[f] = '2026-0' + (i + 1) + '-15';
                } else if (f.indexOf('Count') > -1 || f.indexOf('Qty') > -1 || f.indexOf('Quantity') > -1) {
                    record[f] = (i + 1) * 10;
                } else if (f === 'Status') {
                    record[f] = ['Planned', 'Completed', 'Submitted', 'In Progress', 'Draft'][i % 5];
                } else if (f === 'ConsentStatus') {
                    record[f] = ['OptIn', 'OptOut', 'NotSeen', 'OptIn', 'OptIn'][i % 5];
                } else {
                    record[f] = f + '_Value_' + (i + 1);
                }
            }
            mockRecords.push(record);
        }
        return mockRecords;
    }

    return {
        init: init,
        isOnDevice: isOnDevice,
        getConfigData: getConfigData,
        query: query,
        querySinglePage: querySinglePage,
        fetchNext: fetchNext,
        getAvailableObjects: getAvailableObjects,
        getObjectFields: getObjectFields
    };
})();
