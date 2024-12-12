import { Socket } from "socket.io-client";
import { SocketApi } from "./socket";

const defaultMasterFile = {
  signatures: {},
  files: [],
};

const defaultContentFile = {
  signatures: {},
};

// Function for updating signatures in MasterFile
const createFileSignatures = async (mf: IFileData): Promise<IFileData> => {
  const newSignatures = generateSignatures(5);

  mf.signatures = newSignatures.reduce((acc, signature, index) => {
    acc[index] = signature; // Numbering starts from 0
    return acc;
  }, {} as ISignatures);

  return mf;
};

// Function for generating signatures
const generateSignatures = (signatureCount: number): string[] => {
  const signatures = [];

  for (let i = 0; i < signatureCount; i++) {
    const array = new Uint8Array(33);
    window.crypto.getRandomValues(array);
    const base64String = btoa(String.fromCharCode(...array));
    signatures.push(base64String);
  }

  return signatures;
};

async function encryptFile(
  fileData: any,
  password: string,
  salt = crypto.getRandomValues(new Uint8Array(16)),
  iv = crypto.getRandomValues(new Uint8Array(12)),
  iterations = 100000,
  pbkdf2Salt = crypto.getRandomValues(new Uint8Array(16))
): Promise<IEncryptedFile> {
  fileData = JSON.stringify(fileData);
  const encoder = new TextEncoder();

  // Convert the password to a key using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Parameters for PBKDF2
  const keyDeriveParams = {
    name: "PBKDF2",
    salt: pbkdf2Salt,
    iterations: iterations,
    hash: "SHA-256",
  };

  // Generating a key for AES-GCM
  const key = await crypto.subtle.deriveKey(
    keyDeriveParams,
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // File encryption
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoder.encode(fileData)
  );

  // Form the result
  const result = {
    encryptedData: encryptedData, // Encrypted data as ArrayBuffer
    params: {
      iterations: iterations,
      salt: Array.from(salt)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      iv: Array.from(iv)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      pbkdf2Salt: Array.from(pbkdf2Salt)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    },
  };

  // Return an object with ArrayBuffer and parameters in JSON
  return result;
}

async function hashSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encodedData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

async function decryptFile(encryptedFile: IEncryptedFile, password: string) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // Parsing JSON with encrypted data and parameters
  const { encryptedData, params } = encryptedFile;

  // Convert the parameters back from a hexadecimal string to bytes
  const iv = new Uint8Array(
    (params.iv.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
  );
  const salt = new Uint8Array(
    (params.salt.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
  );
  const pbkdf2Salt = new Uint8Array(
    (params.pbkdf2Salt.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
  );

  // Import password as key for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Deriving an AES-GCM key from a password
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: pbkdf2Salt,
      iterations: params.iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  // Data decryption
  const decryptedData = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encryptedData
  );

  return JSON.parse(decoder.decode(decryptedData));
}

const newDecContentFile = async (
  encryptedData: ArrayBuffer,
  passwordSettings: IPasswordSettings
) => {
  const { password, iv, salt } = passwordSettings;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Converting a password to a key (ensuring the required length of 256 bits)
  const passwordBytes = encoder.encode(password).slice(0, 32);
  const key = await crypto.subtle.importKey(
    "raw",
    passwordBytes, // Теперь пароль точно 256 бит
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );

  const ivArray = new Uint8Array(
    (iv.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
  );

  // Data decryption
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: "AES-CBC",
      iv: ivArray,
    },
    key,
    encryptedData
  );

  const decryptedBytes = new Uint8Array(decryptedData);
  const saltBytes = encoder.encode(salt);
  const saltedData = new Uint8Array(decryptedBytes.length);

  // Applying XOR operation to decrypted data
  for (let i = 0; i < decryptedBytes.length; i++) {
    saltedData[i] = decryptedBytes[i] ^ saltBytes[i % saltBytes.length];
  }

  // Remove 32 random bytes from the beginning of the data after XOR
  const originalData = saltedData.slice(32);

  // Converting data back to a string
  const jsonString = decoder.decode(originalData);

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON:", jsonString);
    throw error; // Переброс ошибки дальше
  }
};

const generateNewPassForContentFile = async (): Promise<IPasswordSettings> => {
  // Generate password
  const passwordBuffer = crypto.getRandomValues(new Uint8Array(32)); // 24 bytes = 32 characters in base64
  const password = arrayBufferToBase64(passwordBuffer);

  // Generation IV
  const ivBuffer = crypto.getRandomValues(new Uint8Array(16)); // 12 bytes for IV
  const iv = arrayBufferToHex(ivBuffer);

  // Salt generation
  const saltBuffer = crypto.getRandomValues(new Uint8Array(32)); // 24 bytes = 32 characters in base64
  const salt = arrayBufferToBase64(saltBuffer);

  return {
    password,
    iv,
    salt,
  };
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
};

const newEncContentFile = async (
  file: Record<string, unknown>,
  passwordSettings: IPasswordSettings
): Promise<Uint8Array> => {
  const { password, iv, salt } = passwordSettings;

  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(file));

  // Generate random bytes (32 bytes)
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));

  // Create a new array for data with extra bytes
  const newData = new Uint8Array(randomBytes.length + data.length);
  newData.set(randomBytes, 0);
  newData.set(data, randomBytes.length);

  // Creating a salt as a byte array for XOR operation
  const saltBytes = encoder.encode(salt);
  const saltedData = new Uint8Array(newData.length);

  // Apply XOR between each byte of new data and the salt
  for (let i = 0; i < newData.length; i++) {
    saltedData[i] = newData[i] ^ saltBytes[i % saltBytes.length];
  }

  const passwordBytes = encoder.encode(password).slice(0, 32);
  const key = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  );

  const ivArray = new Uint8Array(
    (iv.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
  );

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv: ivArray,
    },
    key,
    saltedData
  );

  return new Uint8Array(encryptedData);
};

export class Ulda {
  private password: string;
  private apiKey: string;
  private socket: Socket;

  constructor(apiKey: string, password: string) {
    this.apiKey = apiKey;
    this.password = password;
    this.socket = SocketApi.createConnection();
  }

  //   TODO make private
  async createMasterFile(): Promise<{ data?: IMasterFile; error?: string }> {
    const masterfile = await createFileSignatures(defaultMasterFile);
    const encryptedFile = await encryptFile(masterfile, this.password);
    const hashSignatures = await this.generateLinkedHashes(
      masterfile.signatures
    );

    const socket = SocketApi.createConnection();

    return new Promise((resolve) => {
      socket.emit(
        "master:init",
        {
          key: this.apiKey,
          metadata: JSON.stringify(encryptedFile.params),
          data: encryptedFile.encryptedData,
          hash_signatures: JSON.stringify(hashSignatures),
        },
        async (response: IMasterFileCreatedResponse) => {
          const result = await this.onMasterCreated(response);
          socket.disconnect();
          resolve(result);
        }
      );
    });
  }

  private async onMasterCreated(
    response: IMasterFileCreatedResponse
  ): Promise<{ data?: IMasterFile; error?: string }> {
    const masterfileData = response.data;
    const encryptedData: IEncryptedFile = {
      encryptedData: masterfileData.data,
      params: JSON.parse(masterfileData.metadata),
    };
    const data = await decryptFile(encryptedData, this.password);

    return { data };
  }

  async getContent<T>(): Promise<{
    data?: T;
    error?: string;
  }> {
    const masterfileData = await this.getMasterFile();
    const master = masterfileData.data;

    if (!master) {
      return { error: "Error" };
    }

    const filesData = await this.getContentFile(master);
    const files = filesData.data;

    if (files) {
      const data: Record<string, unknown> = {};

      files.forEach((i) => {
        data[`${i.data.name}`] = i.data.content;
      });
      return { data: data as T };
    }

    return { error: "Error" };
  }

  private async getMasterFile(): Promise<{
    data?: IMasterFile;
    error?: string;
  }> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        "master:get",
        {
          key: this.apiKey,
        },
        async (masterfileData: IMasterfileResponse) => {
          if (masterfileData.data) {
            const encryptedData: IEncryptedFile = {
              encryptedData: masterfileData.data.data,
              params: JSON.parse(masterfileData.data.metadata),
            };

            try {
              const data = await decryptFile(encryptedData, this.password);
              resolve({ data });
            } catch (error) {
              reject({ error: "Error decrypting file" });
            }
          } else {
            reject({ error: masterfileData.error });
          }
        }
      );
    });
  }

  async getContentFile(
    master: IMasterFile
  ): Promise<{ data?: any[]; error?: string }> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        "content:get",
        { ids: master.files.map((i: { id: number }) => i.id) },
        async (result: Array<IContentFile>) => {
          const data = await this.encryptContentFiles(result, master);

          if (data) {
            resolve({ data });
          } else {
            reject({ error: "Error" });
          }
        }
      );
    });
  }

  private async encryptContentFiles(
    data: Array<IContentFile>,
    master: IMasterFile
  ) {
    const files: any[] = [];

    for (const item of data) {
      const passwordSettings = master.files.find(
        (i: IPasswordSettings & { id: number }) => i.id === item.id
      );

      const decryptedContentFile = await newDecContentFile(
        item.data,
        passwordSettings
      );
      files.push({ ...decryptedContentFile, id: item.id });
    }

    return files;
  }

  async updateMasterFile(
    master: IMasterFile
  ): Promise<{ data?: IMasterFile; error?: string }> {
    const masterUpdated = await this.stepUpSignaturesUpdate(master);
    const hashes = await this.generateLinkedHashes(masterUpdated.signatures);
    const encryptedFile = await encryptFile(masterUpdated, this.password);

    return new Promise((resolve, reject) => {
      this.socket.emit(
        "master:update",
        {
          key: this.apiKey,
          metadata: JSON.stringify(encryptedFile.params),
          data: encryptedFile.encryptedData,
          newHashes: hashes,
        },
        async (props: { data?: IEncryptedFile; error?: string }) => {
          const { data, error } = props;

          if (error) {
            reject({ error });
          } else if (data) {
            try {
              const decryptedData = await decryptFile(data, this.password);
              resolve({ data: decryptedData });
            } catch (error) {
              reject({ error: "Error decrypting file" });
            }
          }

          reject({ error: "Error" });
        }
      );
    });
  }

  private async generateLinkedHashes(
    line: ISignatures,
    start: number | null = null,
    end: number | null = null
  ) {
    if (!start) {
      start = Math.min(...Object.keys(line).map(Number));
    }
    if (!end) {
      end = start + 5;
    }
    const depth = end - start + 1;
    let chain: any = {};

    chain[0] = { ...line };
    for (let d = 1; d < depth; d++) {
      chain[d] = {};
      for (let n = d + start; n <= end; n++) {
        chain[d][n] = await hashSHA256(chain[d - 1][n - 1] + chain[d - 1][n]);
      }
    }
    let after: any = {};
    for (let i = 0; i < depth; i++) {
      after[start + i] =
        chain[i][Math.min(...Object.keys(chain[i]).map(Number))];
    }
    return after;
  }

  private async stepUpSignaturesUpdate(master: IFileData): Promise<IFileData> {
    const minId = Math.min(...Object.keys(master.signatures).map(Number));

    delete master.signatures[minId];

    const newSignature = await generateSignatures(1);
    master.signatures[minId + 5] = newSignature[0];

    return master;
  }

  async createContentFile(
    contentData: string,
    name: string
  ): Promise<{ status: string; error?: string }> {
    return new Promise(async (resolve, reject) => {
      try {
        const passwordSettings = await generateNewPassForContentFile();
        const contentFile = await createFileSignatures(defaultContentFile);

        const cf = {
          ...contentFile,
          data: {
            content: { ...JSON.parse(contentData) },
            ...contentFile,
            name,
          },
        };

        const encryptedContentFile = await newEncContentFile(
          cf,
          passwordSettings
        );

        const hashSignatures = await this.generateLinkedHashes(cf.signatures);

        this.socket.emit(
          "content:create",
          {
            data: encryptedContentFile,
            hash_signatures: JSON.stringify(hashSignatures),
          },
          async (id: number) => {
            const masterfileData = await this.getMasterFile();
            const master = masterfileData.data;

            if (master) {
              master.files.push({
                id,
                ...passwordSettings,
              });

              await this.updateMasterFile(master);

              resolve({ status: "OK" });
            }
          }
        );
      } catch (error) {
        reject({ status: "Error", error });
      }
    });
  }

  async saveContentFile(
    name: string,
    content: Record<string, unknown>
  ): Promise<{
    data?: Record<string, unknown>;
    error?: string;
  }> {
    const masterfileData = await this.getMasterFile();
    const master = masterfileData.data;

    if (!master) {
      return { error: "Error" };
    }

    const filesData = await this.getContentFile(master);
    const files = filesData.data;
    const fileData = files?.find((f) => f.data.name === name);

    if (fileData.data) {
      const contentUpdated = await this.stepUpSignaturesUpdate({
        ...fileData,
        data: {
          ...fileData.data,
          content,
        },
      });

      const hashes = await this.generateLinkedHashes(contentUpdated.signatures);
      const passwordSettings = master.files.find(
        (i: IPasswordSettings & { id: number }) => i.id === fileData.id
      );
      const encryptedContentFileData = await newEncContentFile(
        contentUpdated,
        passwordSettings
      );

      return new Promise((resolve, reject) => {
        try {
          this.socket.emit(
            "content:update",
            {
              id: fileData.id,
              data: encryptedContentFileData,
              newHashes: hashes,
            },
            async (props: { data?: IEncryptedFile; error?: string }) => {
              const { error } = props;

              console.log("[saveContentFile] props: ", props);

              if (error) {
                reject({ error });
              }

              resolve({ data: content });
            }
          );
        } catch (error) {
          reject({ error: "Error" });
        }
      });
    } else {
      return { error: "File not found, please check name" };
    }
  }
}

export interface IFileData extends Record<string, any> {
  signatures: any;
  // files: Record<string, any>;
}

export interface IMasterFile extends IFileData {
  files: Record<string, any>;
}

export interface IContentFile extends IFileData {
  id: number;
  data: Buffer;
}

interface ISignatures {
  [key: number]: string;
}

export interface IEncryptedFile {
  encryptedData: ArrayBuffer;
  params: IEncryptedFileParams;
}

interface IEncryptedFileParams {
  iterations: number;
  salt: string;
  iv: string;
  pbkdf2Salt: string;
}

interface IMasterFileCreatedResponse {
  id: string;
  data: { data: ArrayBuffer; metadata: string };
}

interface IMasterfileResponse {
  data?: IMasterfileData;
  error?: string;
}

interface IMasterfileData {
  data: ArrayBuffer;
  metadata: string;
}

export interface IPasswordSettings {
  password: string;
  iv: string;
  salt: string;
}
