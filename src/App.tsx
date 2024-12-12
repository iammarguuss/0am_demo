import { useEffect, useState } from "react";

import styles from "./App.module.scss";
import { SocketApi } from "./socket";
import { Spinner } from "./components/Spinner";
import { Input } from "./components/Input";
import { Button } from "./components/Button";
import { Textarea } from "./components/Textarea";
import { Ulda } from "./ulda";

interface IFiles {
  test2: Record<string, any>;
  test3: Record<string, any>;
}

const App = () => {
  const [ulda, setUlda] = useState<Ulda | undefined>();

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();
  const [connected, setConnected] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [testApiKey, setTestApiKey] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [selectedName, setSelectedName] = useState<keyof IFiles | undefined>();
  const [contentFilesData, setContentFilesData] = useState<
    IFiles | undefined
  >();
  const [contentData, setContentData] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [contentForEdit, setContentForEdit] = useState<string>("");

  useEffect(() => {
    setConnected(!!SocketApi.instance?.connected);
  }, [SocketApi.instance, SocketApi.instance?.connected]);

  useEffect(() => {
    return () => {
      onDisconnect();
    };
  }, []);

  // ! Only for test
  const onCreateMasterFile = async () => {
    const ulda = new Ulda(testApiKey, password);
    const masterfile = await ulda.createMasterFile();

    if (masterfile) {
      setTestApiKey("");
      onError("Please login");
      onDisconnect();
    } else {
      onError("Error decrypting file");
      onDisconnect();
    }
  };

  const onCreateContentFile = async () => {
    if (ulda) {
      const result = await ulda.createContentFile(contentData, name);

      if (result.status === "OK") {
        setContentData("");
        setName("");

        const content = await ulda.getContent<IFiles>();
        setContentFilesData(content.data);
      } else {
        onDisconnect();
      }
    }
  };

  const onDisconnect = async () => {
    SocketApi.instance?.disconnect();
    setConnected(!!SocketApi.instance?.connected);
    onError("Please login");
    setApiKey("");
    setPassword("");
    setSelectedName(undefined);
  };

  const onConnect = async () => {
    setError(undefined);

    try {
      setLoading(true);

      if (password) {
        const ulda = new Ulda(apiKey, password);
        setUlda(ulda);

        const content = await ulda.getContent<IFiles>();

        setContentFilesData(content.data);
      } else {
        onDisconnect();
      }
    } catch (e) {
      onError("Failed to Connection");
    } finally {
      setLoading(false);
    }
  };

  const onError = (error = "Unknown Error") => {
    setError(error);
    setTimeout(() => {
      setError(undefined);
    }, 5000);
  };

  const onEdit = () => {
    if (selectedName && contentFilesData) {
      setContentForEdit(JSON.stringify(contentFilesData[selectedName]));
    }
  };

  const onSave = async () => {
    if (ulda && selectedName) {
      await ulda.saveContentFile(selectedName, JSON.parse(contentForEdit));
      const content = await ulda.getContent<IFiles>();
      setContentFilesData(content.data);
      setContentForEdit("");
    } else {
      onError("");
    }
  };

  const onFileClick = (i: keyof IFiles) => {
    if (!contentFilesData) {
      return;
    }

    setSelectedName(i);
    setContentForEdit("");
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>Test ULDA</div>

        <div className={styles.connectWrapper}>
          {SocketApi.instance ? (
            <Button label="Disconnect" onClick={onDisconnect} />
          ) : (
            <>
              <Input
                placeholder="api key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <div className="ml-2">
                <Input
                  placeholder="password"
                  value={password}
                  type="password"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button label="Connect" onClick={onConnect} className="ml-2" />
            </>
          )}
        </div>
      </header>

      <div className={styles.container}>
        <div className={styles.sidebar}>
          {connected && (
            <div>
              <Input
                className="my-2"
                placeholder="file name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <Textarea
                label="Content File content (JSON)"
                value={contentData}
                onChange={(e) => setContentData(e.target.value)}
              />

              <Button
                label="Create Content File"
                onClick={onCreateContentFile}
              />
            </div>
          )}

          <div className="mt-auto">
            <h4>Only for test</h4>
            <Input
              className="my-2"
              placeholder="test api key"
              value={testApiKey}
              onChange={(e) => setTestApiKey(e.target.value)}
            />
            <Input
              className="my-2"
              placeholder="password"
              value={password}
              type="password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button label="Create Master File" onClick={onCreateMasterFile} />
          </div>
        </div>

        {connected && (
          <div className={styles.content}>
            {loading && <Spinner size={8} />}
            {error && <div className={styles.error}>{error}</div>}

            {contentFilesData && (
              <>
                <div>Content Files: </div>
                <div>
                  {Object.keys(contentFilesData).map((i) => (
                    <div key={i} onClick={() => onFileClick(i as keyof IFiles)}>
                      {i}
                    </div>
                  ))}
                </div>
              </>
            )}

            {contentFilesData && selectedName && !contentForEdit && (
              <div className="mt-4">
                <div>Content: </div>
                <div className="mt-2">
                  {JSON.stringify(contentFilesData[selectedName])}
                </div>
                <Button className="mt-2" label="Edit" onClick={onEdit} />
              </div>
            )}

            {contentForEdit && (
              <div className="mt-4">
                <Textarea
                  label="Content File content (JSON)"
                  value={contentForEdit}
                  onChange={(e) => setContentForEdit(e.target.value)}
                />

                <div>
                  <Button
                    label="Cancel"
                    onClick={() => setContentForEdit("")}
                    className="mr-2 bg-red-400 hover:bg-red-500"
                  />
                  <Button label="Save" onClick={onSave} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
