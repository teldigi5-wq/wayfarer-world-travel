# Offline API performance benchmark

This benchmark is intentionally **not a production load test**. It measures in-process Node.js handler overhead on a shared CI runner with **all outside HTTP calls replaced by local fixtures**. It does not establish user-perceived web latency, provider uptime, mobile frame rate, global scale, browser load times, TLS/edge latency, paid API cost, or availability.

## Reproduce
Requires Node.js 24:

```bash
npm run check
npm test
npm run benchmark:offline
```

The benchmark requires no credentials or installed dependencies. Its output is `benchmark-results.json`; the dedicated `Offline API performance baseline` workflow uploads that JSON as a 14-day artifact and logs each result as `BENCH` and `BENCH_SUMMARY`.

## Scenarios
| Scenario | Runs | Tested boundary |
| --- | ---: | --- |
| Invalid nearby coordinates | 240 | Request validation; 400 without upstream calls |
| Nearby 380 synthetic map features | 100 | JSON stream decoding, distance/ranking, bounded output |
| Wikipedia destination search | 120 | One mocked source; normalized result |
| Intelligence: weather, place, country | 100 | Three mocked sources, production AI composer disabled |
| Production travel-search lock | 240 | No billable provider call |
| Production travel-offers lock | 240 | No billable provider call |

Every iteration asserts its HTTP status or response contract. Any unexpected network/provider access fails the run. Runs are **serial**, deliberately below local admission limits; the measured throughput is *in-process handler operations per second*, not concurrent production requests per second.

## Metrics and comparability
Per scenario: operation count and success count, median/p95/p99/max handler duration, elapsed time, in-process operations/s, CPU time (user+system), peak measured heap, post-GC heap delta, and mocked fetch count. Each scenario warms up for 12 calls. Heap measurements are observational and GC-dependent.

Results include the commit, Node version, OS and CPU model. Absolute latency values fluctuate on GitHub-hosted shared runners: the provisional p95 budgets are **advisory**, not CI-blocking SLA guarantees. Contract correctness and network isolation are blocking. Compare changes under similar runners, node versions, fixtures, iteration counts and no concurrent unrelated heavy jobs. Run multiple independent samples before drawing performance conclusions.

## Release decisions
To establish production-facing benchmarks, separately test a controlled/staged deployment after authorization with representative client locations, device/browser profiling, permitted rate-limited concurrency, and **synthetic accounts only**. Review distributed quotas before any external-provider load test. Do not benchmark live student records, pay-per-request endpoints, or public production traffic without safeguards and explicit scope.
