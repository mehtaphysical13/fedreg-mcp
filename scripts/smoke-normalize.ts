/**
 * Smoke test for normalization + agency resolution against the live API.
 */

import { searchArticles, getDocument } from "../src/lib/fedreg.js";
import { normalizeDocument, dedupeAcrossStages } from "../src/lib/normalize.js";
import { resolveAgency, resolveAgencies } from "../src/lib/agencyHelp.js";

async function main() {
  console.log("--- resolveAgency tests ---");
  for (const input of [
    "EPA",
    "environmental protection agency",
    "Securities and Exchange Commission",
    "FDA",
    "completely-made-up-agency",
  ]) {
    const slug = await resolveAgency(input);
    console.log(`  "${input}" -> ${slug ?? "(unresolved)"}`);
  }

  console.log("\n--- normalize: 5 recent EPA proposed rules ---");
  const search = await searchArticles({
    agencies: ["environmental-protection-agency"],
    type: ["PRORULE"],
    perPage: 5,
    order: "newest",
  });
  for (const raw of search.results) {
    const r = normalizeDocument(raw);
    console.log(
      `  ${r.id} stage=${r.stage} agencies=${r.agencies.map((a) => a.slug).join(",")} cfr=${r.cfrRefs.map((c) => c.citation).join(",")} comments_open=${r.commentPeriod?.isOpen ?? "n/a"}`
    );
  }

  console.log("\n--- dedupeAcrossStages ---");
  const mixed = await searchArticles({
    agencies: ["securities-and-exchange-commission"],
    perPage: 10,
    order: "newest",
  });
  const rules = mixed.results.map(normalizeDocument);
  const deduped = dedupeAcrossStages(rules);
  console.log(`  in=${rules.length} deduped=${deduped.length}`);

  console.log("\n--- resolveAgencies (batch) ---");
  const batch = await resolveAgencies(["EPA", "FDA", "DOT", "Foobar"]);
  console.log(
    `  resolved=${batch.resolved.length} unresolved=${batch.unresolved.join(",")}`
  );

  console.log("\n--- single getDocument + normalize ---");
  if (search.results.length > 0) {
    const doc = await getDocument(search.results[0].document_number);
    const r = normalizeDocument(doc);
    console.log(
      `  id=${r.id} title="${r.title.slice(0, 60)}" stage=${r.stage} comment_period=${JSON.stringify(r.commentPeriod)}`
    );
  }

  console.log("\n✅ Normalization smoke checks passed.");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
