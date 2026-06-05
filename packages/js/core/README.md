# @app-foundry/core

Shared primitives for AppFoundry JavaScript packages.

## Example

```js
import { truncateJsonValue } from "@app-foundry/core";

const payload = truncateJsonValue(value, 256 * 1024);
```

This package intentionally stays small and framework-free. Capability packages
such as `@app-foundry/debug` and `@app-foundry/media` own the user-facing
production-safety behavior.
