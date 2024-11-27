# 0am

### Init with apiKey and password

```ts
const ulda = new Ulda(apiKey, password);
```

### Get Master File Data ({ data?: { files: [] }, error?: string })

```ts
const master = await ulda.getMasterFile();
```

### Create Content File (contentData: string)

```ts
const contentFile = await ulda.createContentFile(contentData);

// update Master File after adding Content File
master.files.push({
  id: contentFile.id,
  passwordSettings: contentFile.passwordSettings,
});

const updatedMasterFile = await ulda.updateMasterFile(master);
```

### Get Content Files { data?: Array<{ id: number; data: Buffer;}>; error?: string }

```ts
const contentFiles = await ulda.getContentFile(master.data);
```

### Update Content File

```ts
const contentFile = contentFiles.data[0];

contentFile.value = 1;

await ulda.updateContentFile(master, contentFile);
```
