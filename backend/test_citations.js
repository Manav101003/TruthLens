const {extractCitations} = require('./services/citationVerifier');
const text = "NASA was founded in 1958. According to Smith et al. 2019, the Eiffel Tower is in Berlin. A recent study (Johnson, 2023) found results. See https://fake-journal.example.com/study. DOI: 10.1038/s41586-023-01814-z";
const result = extractCitations(text);
console.log("Found citations:", result.length);
console.log(JSON.stringify(result, null, 2));
