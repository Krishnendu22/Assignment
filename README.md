Autocomplete API Documentation (V1, V2, V3)
Overview
The autocomplete API at http://35.200.185.69:8000 provides name suggestions based on input queries. The API has three versions: V1, V2, and V3, each with different constraints and behaviors.

V1 API Findings
Endpoint:
/v1/autocomplete?query=<string>&page=<num>

Constraints & Behavior:
Rate Limit: 100 requests per minute (returns 429 error if exceeded).

Pagination: Works using page parameter, with 10 results per page.

Query Behavior:

Empty queries return 10 results.

Single-character queries return 10 results.

Multi-character queries return matching names.

No explicit limit parameter; fixed 10 results per request.

Error Handling: Lacks rate limit headers (just returns 429 with “100 per 1 minute”).

Optimal Extraction Approach: Systematically query using prefixes (a, aa, aaa, etc.) and paginate.

V2 API Findings
Endpoint:
/v2/autocomplete?query=<string>&page=<num>

Constraints & Behavior:
Rate Limit: More restrictive than V1, often returning 429 after just a few rapid requests.

Pagination: Uses page, but results per page are 12 instead of 10.

Query Behavior:

Empty queries return results (like V1).

Single-character queries return names but take longer due to pagination.

Some queries return fewer results than expected.

Error Handling: Frequent 429 errors require aggressive rate limiting.

Optimal Extraction Approach:

Use recursive exploration with a prefix-based strategy.

Handle rate limits by adding delays and retry mechanisms.

V3 API Findings
Endpoint:
/v3/autocomplete?query=<string>&page=<num>

Constraints & Behavior:
Rate Limit: More efficient than V2, allowing faster queries.

Pagination: Returns 15 results per page (higher than V1 & V2).

Query Behavior:

Empty queries return 15 names.

Single-character queries work efficiently.

Multi-character queries return names but sometimes fewer results.

Supports special characters in queries.

Optimal Extraction Approach:

Use prefix-based expansion (a, ab, abc etc.).

Take advantage of the larger result size per request.

