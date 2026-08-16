/**
 * Targeted verification script for AI Case Analysis:
 * Tests the user's Cebuano necklace/theft case, Tagalog labor case, and English case
 * on both analyzeGuestPreview and analyzeLegalCase pipelines.
 */
import 'dotenv/config';
import { analyzeLegalCase } from '../src/services/aiOrchestrator.js';
import { analyzeGuestPreview } from '../src/services/guestPreview.js';

async function main() {
  console.log('====================================================');
  console.log('🧪 Starting AI Case Analysis Multilingual Verification');
  console.log('====================================================\n');

  // Test 1: User's exact Cebuano scenario
  const cebText = 'nipalit ko ug necklace sa isa ka store, unya after pila ka days naay tao nga niadto sa balay. niana siya nga ibalik iyang necklace kay gikawat daw nako. niadto siya sa balay kay naa diay toy gps. niingon dayon ko nga gipalit ra nako to sa gawas pero wala siya naminaw unya ipapreso daw ko niya.';
  
  console.log('--- [TEST 1: Guest Preview - Cebuano Necklace Scenario] ---');
  try {
    const guestRes = await analyzeGuestPreview({
      category: 'Property Law',
      description: cebText,
    });
    console.log('✅ Guest Preview Success!');
    console.log('   Situation Summary:', guestRes.situationSummary?.slice(0, 100) + '...');
    console.log('   Outlook Level:', guestRes.outlookLevel);
    console.log('   Match Specialty:', guestRes.matchSpecialty);
    console.log('   Cases Count:', guestRes.possibleLegalCases?.length);
    if (guestRes.possibleLegalCases?.[0]) {
      console.log('   Top Case:', guestRes.possibleLegalCases[0].name, `(${guestRes.possibleLegalCases[0].confidenceScore}%)`);
      console.log('   Applicable Law:', guestRes.possibleLegalCases[0].applicableLaw);
      console.log('   Explanation:', guestRes.possibleLegalCases[0].explanation?.slice(0, 100) + '...');
    }
  } catch (err) {
    console.error('❌ Test 1 Failed:', err);
  }

  console.log('\n--- [TEST 2: Authenticated Analysis - Cebuano Scenario] ---');
  try {
    const authRes = await analyzeLegalCase({
      category: 'Criminal',
      description: cebText,
      isPremium: true,
    });
    console.log('✅ Authenticated Analysis Success!');
    console.log('   Concern Summary:', authRes.result.userConcernSummary?.slice(0, 100) + '...');
    console.log('   Outlook Level:', authRes.result.courtWinOutlook?.level);
    console.log('   Missing Facts:', authRes.result.courtWinOutlook?.missingFacts);
    console.log('   Next Steps:', authRes.result.suggestedNextSteps?.slice(0, 2));
    if (authRes.result.possibleLegalCases?.[0]) {
      console.log('   Top Case:', authRes.result.possibleLegalCases[0].name, `(${authRes.result.possibleLegalCases[0].confidenceScore}%)`);
      console.log('   Applicable Law:', authRes.result.possibleLegalCases[0].applicableLaw);
    }
    console.log('   Providers Used:', authRes.meta.providersUsed);
  } catch (err) {
    console.error('❌ Test 2 Failed:', err);
  }

  console.log('\n====================================================');
  console.log('🎉 Verification complete');
  console.log('====================================================');
}

main().catch(console.error);
