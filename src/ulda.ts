import { Socket } from "socket.io-client";
import { SocketApi } from "./socket";

const defaultMasterFile = {
  signatures: {},
  files: [],
};

// Функция для обновления подписей в MasterFile
const createMasterFileSignatures = async (
  mf: IMasterFile
): Promise<IMasterFile> => {
  const newSignatures = generateSignatures(5);

  mf.signatures = newSignatures.reduce((acc, signature, index) => {
    acc[index] = signature; // Начало нумерации с 0
    return acc;
  }, {} as ISignatures);

  return mf;
};

// Функция для генерации подписей
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

  // Преобразуем пароль в ключ, используя PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Параметры для PBKDF2
  const keyDeriveParams = {
    name: "PBKDF2",
    salt: pbkdf2Salt,
    iterations: iterations,
    hash: "SHA-256",
  };

  // Создание ключа для AES-GCM
  const key = await crypto.subtle.deriveKey(
    keyDeriveParams,
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // Шифрование файла
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoder.encode(fileData)
  );

  // Формируем результат
  const result = {
    encryptedData: encryptedData, // Зашифрованные данные как ArrayBuffer
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

  // Возвращаем объект с ArrayBuffer и параметрами в JSON
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

  // Разбор JSON с зашифрованными данными и параметрами
  const { encryptedData, params } = encryptedFile;

  // Преобразуем параметры обратно из шестнадцатеричной строки в байты
  const iv = new Uint8Array(
    (params.iv.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
  );
  const salt = new Uint8Array(
    (params.salt.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
  );
  const pbkdf2Salt = new Uint8Array(
    (params.pbkdf2Salt.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
  );

  // Импортируем пароль как ключ для PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Деривация ключа AES-GCM из пароля
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

  // Расшифровка данных
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

  // Преобразование пароля в ключ (обеспечение нужной длины 256 бит)
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

  // Расшифровка данных
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

  // Применение операции XOR к расшифрованным данным
  for (let i = 0; i < decryptedBytes.length; i++) {
    saltedData[i] = decryptedBytes[i] ^ saltBytes[i % saltBytes.length];
  }

  // Удаление 32 случайных байт из начала данных после XOR
  const originalData = saltedData.slice(32);

  // Преобразование данных обратно в строку
  const jsonString = decoder.decode(originalData);

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON:", jsonString);
    throw error; // Переброс ошибки дальше
  }
};

export const generateNewPassForContentFile =
  async (): Promise<IPasswordSettings> => {
    // Генерация пароля
    const passwordBuffer = crypto.getRandomValues(new Uint8Array(32)); // 24 байта = 32 символа в base64
    const password = arrayBufferToBase64(passwordBuffer);

    // Генерация IV
    const ivBuffer = crypto.getRandomValues(new Uint8Array(16)); // 12 байт для IV
    const iv = arrayBufferToHex(ivBuffer);

    // Генерация соли
    const saltBuffer = crypto.getRandomValues(new Uint8Array(32)); // 24 байта = 32 символа в base64
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

export const newEncContentFile = async (
  file: Record<string, unknown>,
  passwordSettings: IPasswordSettings
): Promise<Uint8Array> => {
  const { password, iv, salt } = passwordSettings;

  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(file));

  // Генерация случайных байтов (32 байта)
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));

  // Создание нового массива для данных с дополнительными байтами
  const newData = new Uint8Array(randomBytes.length + data.length);
  newData.set(randomBytes, 0);
  newData.set(data, randomBytes.length);

  // Создание соли в виде байтового массива для XOR операции
  const saltBytes = encoder.encode(salt);
  const saltedData = new Uint8Array(newData.length);

  // Применение XOR между каждым байтом новых данных и солью
  for (let i = 0; i < newData.length; i++) {
    saltedData[i] = newData[i] ^ saltBytes[i % saltBytes.length];
  }

  // Преобразование пароля в ключ (обеспечение нужной длины 256 бит)
  const passwordBytes = encoder.encode(password).slice(0, 32);
  const key = await crypto.subtle.importKey(
    "raw",
    passwordBytes, // Теперь пароль точно 256 бит
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  );

  const ivArray = new Uint8Array(
    (iv.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
  );

  // Шифрование солёных данных
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
    const masterfile = await createMasterFileSignatures(defaultMasterFile);
    const encryptedFile = await encryptFile(masterfile, this.password);
    const hashSignatures = await this.generateLinkedHashes(
      masterfile.signatures
    );

    if (this.socket) {
      return new Promise((resolve) => {
        this.socket.emit(
          "master:init",
          {
            key: this.apiKey,
            metadata: JSON.stringify(encryptedFile.params),
            data: encryptedFile.encryptedData,
            hash_signatures: JSON.stringify(hashSignatures),
          },
          // TODO check async
          async (response: IMasterFileCreatedResponse) => {
            const result = await this.onMasterCreated(response);
            resolve(result);
          }
        );
      });
    } else {
      return { error: "Error decrypting file" };
    }
  }

  private async onMasterCreated(
    response: IMasterFileCreatedResponse
  ): Promise<{ data?: IMasterFile; error?: string }> {
    const masterfileData = response.masterfileData;
    const encryptedData: IEncryptedFile = {
      encryptedData: masterfileData.data,
      params: JSON.parse(masterfileData.metadata),
    };
    const data = await decryptFile(encryptedData, this.password);

    return { data };
  }

  async getMasterFile(): Promise<{ data?: IMasterFile; error?: string }> {
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
  ): Promise<{ data?: IContentFile[]; error?: string }> {
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
        //chain[d][n] = sha(chain[d-1][n-1]+chain[d-1][n])
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

  // Функция для обновления подписей, удаляя старую и добавляя новую
  private async stepUpSignaturesUpdate(
    master: IMasterFile
  ): Promise<IMasterFile> {
    const minId = Math.min(...Object.keys(master.signatures).map(Number));

    // Удаление подписи с индексом 0
    delete master.signatures[minId];

    // Генерация новой подписи и добавление её с индексом 10
    const newSignature = await generateSignatures(1);
    master.signatures[minId + 5] = newSignature[0];

    return master;
  }

  async createContentFile(contentData: string): Promise<{
    data?: { id: number; passwordSettings: IPasswordSettings };
    error?: string;
  }> {
    return new Promise(async (resolve, reject) => {
      try {
        const passwordSettings = await generateNewPassForContentFile();
        const encryptedContentFile = await newEncContentFile(
          JSON.parse(contentData),
          passwordSettings
        );

        this.socket.emit(
          "content:create",
          {
            data: encryptedContentFile,
          },
          (id: number) => {
            resolve({ data: { id, passwordSettings } });
          }
        );
      } catch (error) {
        reject({ error: "Error" });
      }
    });
  }

  async updateContentFile(
    master: IMasterFile,
    contentData: string,
    id: number
  ): Promise<{
    data?: { id: number; passwordSettings: IPasswordSettings };
    error?: string;
  }> {
    return new Promise(async (resolve, reject) => {
      try {
        const passwordSettings = master.files.find(
          (i: IPasswordSettings & { id: number }) => i.id === id
        );
        const fileData = JSON.parse(contentData);
        const encryptedContentFile = await newEncContentFile(
          fileData,
          passwordSettings
        );

        this.socket.emit(
          "content:update",
          {
            id: fileData.id,
            data: encryptedContentFile,
            // TODO validate before update
            // key: apiKey,
            // newHashes: hashes,
          },
          (id: number) => {
            resolve({ data: { id, passwordSettings } });
          }
        );
      } catch (error) {
        reject({ error: "Error" });
      }
    });
  }
}

export interface IMasterFile {
  signatures: any;
  files: Record<string, any>;
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
  masterfileData: { data: ArrayBuffer; metadata: string };
}

interface IMasterfileResponse {
  data?: IMasterfileData;
  error?: string;
}

interface IMasterfileData {
  data: ArrayBuffer;
  metadata: string;
}

interface IContentFile {
  id: number;
  data: Buffer;
}

export interface IPasswordSettings {
  password: string;
  iv: string;
  salt: string;
}
