/**
 * Live smoke test for the federalregister.gov wrapper.
 * Run with: npx tsx scripts/smoke-fedreg.ts
 */

import { searchArticles, getDocument, listAgencies } from "../src/lib/fedreg.js";

async function main() {
  console.log("--- searchArticles: recent EPA proposed rules ---");
  const search = await searchArticles({
    query: "emissions",
    agencies: ["environmental-protection-agency"],
    type: ["PRORULE"], // search filter code; response will show "Proposed Rule"
    fromDate: "2025-01-01",
    perPage: 3,
    order: "newest",
  });
  console.log(
    `count=${search.count} returned=${search.results.length} pages=${search.total_pages}`
  );
  for (const r of search.results.slice(0, 3)) {
    console.log(`  - ${r.document_number} | ${r.publication_date} | ${r.title.slice(0, 80)}`);
  }

  if (search.results.length > 0) {
    const first = search.results[0];
    console.log(`\n--- getDocument: ${first.document_number} ---`);
    const doc = await getDocument(first.document_number);
    console.log(
      `title=${doc.title.slice(0, 80)}  type=${doc.type}  agencies=${doc.agencies?.map(a => a.slug).join(",")}  cfr=${doc.cfr_references?.map(c => `${c.title}/${c.part}`).join(",")}`
    );
  }

  console.log("\n--- listAgencies: top 5 ---");
  const agencies = await listAgencies();
  console.log(`total_agencies=${agencies.length}`);
  for (const a of agencies.slice(0, 5)) {
    console.log(`  - ${a.slug} | ${a.name}`);
  }
  console.log("\n✅ All smoke checks passed.");
}

main().catch((err) => {
  console.error("❌ Smoke test failed:", err);
  process.exit(1);
});
