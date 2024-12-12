# 0am

### Init with apiKey and password

```ts
const ulda = new Ulda(apiKey, password);
```

### Get Files Data ({ data?: { foo: "bar" }, error?: string })

```ts
const content = await ulda.getContent<{ foo: string }>();
```

### Create Content File (contentData: string)

```ts
await ulda.createContentFile(contentData, fileName);
```

### Update Content File

```ts
const contentFile = content.data.foo;

contentFile.value = 1;

await ulda.saveContentFile(fileName, contentFile);
```
