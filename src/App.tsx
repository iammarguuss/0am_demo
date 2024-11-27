import { useEffect, useState } from "react";

import styles from "./App.module.scss";
import { SocketApi } from "./socket";
import { Spinner } from "./components/Spinner";
import { IMasterFile } from "./crypto";
import { Input } from "./components/Input";
import { Button } from "./components/Button";
import { Textarea } from "./components/Textarea";
import { IContentFile, IPasswordSettings, Ulda } from "./ulda";

const App = () => {
  const [ulda, setUlda] = useState<Ulda | undefined>();

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();
  const [connected, setConnected] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [testApiKey, setTestApiKey] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [master, setMaster] = useState<IMasterFile | undefined>();
  const [content, setContent] = useState<IContentFile>();
  const [contentFiles, setContentFiles] = useState<Array<any>>([]); // TODO type
  const [contentData, setContentData] = useState<string>("");
  const [contentForEdit, setContentForEdit] = useState<string>("");

  useEffect(() => {
    setConnected(!!SocketApi.instance?.connected);
  }, [SocketApi.instance, SocketApi.instance?.connected]);

  useEffect(() => {
    if (master?.files.length && ulda) {
      const getContentFiles = async (ulda: Ulda, master: IMasterFile) => {
        const filesData = await ulda.getContentFile(master);

        if (filesData.data) {
          setContentFiles(filesData.data);
        } else {
          onError(filesData.error);
        }
      };

      getContentFiles(ulda, master);
    }
  }, [master]);

  useEffect(() => {
    return () => {
      onDisconnect();
    };
  }, []);

  const onCreateMasterFile = async () => {
    const ulda = new Ulda(testApiKey, password);
    const masterfile = await ulda.createMasterFile();

    if (masterfile) {
      setMaster(masterfile.data);
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
      const result = await ulda.createContentFile(contentData);
      if (result.data) {
        addContentToMasterFile(result.data.id, result.data.passwordSettings);
      }
    }
  };

  const onDisconnect = async () => {
    SocketApi.instance?.disconnect();
    setConnected(!!SocketApi.instance?.connected);
    onError("Please login");
    setApiKey("");
    setPassword("");
    setContent(undefined);
  };

  const onConnect = async () => {
    setError(undefined);

    try {
      setLoading(true);

      if (password) {
        const ulda = new Ulda(apiKey, password);
        setUlda(ulda);

        const masterfileData = await ulda.getMasterFile();

        if (!masterfileData.data || masterfileData.error) {
          onError(masterfileData.error!);
          return;
        }

        setMaster(masterfileData.data);
      } else {
        onDisconnect();
      }
    } catch (e) {
      console.error("Create Connection Error: ", e);
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

  const addContentToMasterFile = async (
    id: number,
    passwordSettings: IPasswordSettings
  ) => {
    if (master && ulda) {
      master.files.push({
        id,
        ...passwordSettings,
      });

      const result = await ulda.updateMasterFile(master);

      if (result.data) {
        setMaster(result.data);
      } else {
        onDisconnect();
      }
    }
  };

  const onEdit = () => {
    if (content) {
      setContentForEdit(JSON.stringify(content.data));
    }
  };

  const onSave = async () => {
    if (ulda && master && content) {
      const updated = {
        ...content,
        data: JSON.parse(contentForEdit),
      };
      ulda.updateContentFile(master, updated);

      setContentForEdit("");
      setContent(updated);

      const masterfileData = await ulda.getMasterFile();

      if (!masterfileData.data || masterfileData.error) {
        onError(masterfileData.error!);
        return;
      }

      setMaster(masterfileData.data);
    } else {
      onDisconnect();
    }
  };

  const onFileClick = (i: IContentFile) => {
    setContent(i);
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
          {/* <Button label="TEST" onClick={test} /> */}

          {connected && (
            <div>
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

            {contentFiles.length > 0 && (
              <>
                <div>Content Files: </div>
                <div>
                  {contentFiles.map((i: IContentFile) => (
                    <div key={i.id} onClick={() => onFileClick(i)}>
                      {i.id}
                    </div>
                  ))}
                </div>
              </>
            )}

            {content && !contentForEdit && (
              <div className="mt-4">
                <div>Content: </div>
                <div className="mt-2">{JSON.stringify(content.data)}</div>
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
