const express = require('express');
const controller = require('../../controllers/loggerController');
const {
  validateNarrativePayload,
  validateLookupPayload,
  validateFastTrackPayload,
  validateBusinessActionPayload,
} = require('../../middleware/validators');

const router = express.Router();

router.post('/narrative', validateNarrativePayload, controller.postNarrative);
router.post('/lookup', validateLookupPayload, controller.postLookup);
router.post('/coupon-conflicts', controller.postCouponConflicts);
router.post('/promotion-risk', controller.postPromotionRisk);
router.post('/business-scenario-step', controller.postBusinessScenarioStep);

router.get('/examples', controller.getExampleCatalog);
router.get('/business-actions', controller.getBusinessActions);
router.get('/business-actions/:actionId/draft', controller.getBusinessActionDraft);
router.post('/business-actions/execute', validateBusinessActionPayload, controller.postExecuteBusinessAction);

router.get('/fast-track/scenarios', controller.getFastTrackScenarios);
router.get('/fast-track/templates/add-flight-product-body', controller.getAddFlightTemplate);
router.get('/fast-track/templates/add-hotel-product-body', controller.getAddHotelTemplate);
router.get('/fast-track/templates/prepare-body', controller.getPrepareTemplate);
router.post('/fast-track/execute', validateFastTrackPayload, controller.executeFastTrack);

module.exports = router;
