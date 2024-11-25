interface ISignatures {
  [key: number]: string;
}

export interface IMasterFile {
  signatures: any;
  files: Record<string, any>;
}

interface IEncryptedContentFile {
  encryptedData: ArrayBuffer;
  iv: string;
}

export interface Base64FileData {
  base64: string;
  fileName: string;
  mimeType: string;
}

const masterFile: IMasterFile = {
  signatures: {},
  files: [],
};

// export const generateLinkedHashes = async (signatures: ISignatures): Promise<ISignatures> => {
//   let newLine = { ...signatures }; // Создаем копию объекта для безопасной модификации
//   const firstKey = parseInt(Object.keys(newLine)[0]);
//   const lastKey = firstKey + 6;

//   for (let i = firstKey; i <= lastKey; i++) {
//     if (newLine[i] !== undefined) {
//       // Убедимся, что ключ существует перед хешированием
//       for (let j = firstKey + 1; j <= i; j++) {
//         newLine[i] = await hashSHA256(newLine[i]); // Применяем хеширование
//       }
//     }
//   }

//   return newLine;
// }



// export async function encryptContentFile(
//   fileData: Record<string, unknown>,
//   password: string,
//   iv = crypto.getRandomValues(new Uint8Array(12))
// ): Promise<IEncryptedContentFile> {
//   const encoder = new TextEncoder();

//   // Генерация хеша SHA-256 из пароля
//   const hashBuffer = await crypto.subtle.digest(
//     "SHA-256",
//     encoder.encode(password)
//   );
//   const keyBuffer = hashBuffer.slice(0, 32); // Обрезаем до 256 бит, если нужно

//   // Импорт ключа из хеша для AES-GCM
//   const key = await crypto.subtle.importKey(
//     "raw",
//     keyBuffer,
//     { name: "AES-GCM", length: 256 },
//     false,
//     ["encrypt"]
//   );

//   // Шифрование файла
//   const encryptedData = await crypto.subtle.encrypt(
//     { name: "AES-GCM", iv: iv },
//     key,
//     encoder.encode(JSON.stringify(fileData))
//   );

//   return {
//     encryptedData: encryptedData,
//     iv: Array.from(iv)
//       .map((b) => b.toString(16).padStart(2, "0"))
//       .join(""),
//   };
// }

// export async function decryptContentFile(
//   encryptedFile: IEncryptedContentFile,
//   password: string
// ): Promise<Base64FileData | null> {
//   const decoder = new TextDecoder();
//   const encoder = new TextEncoder();

//   // Преобразование IV обратно в тип Uint8Array
//   const iv = new Uint8Array(
//     (encryptedFile.iv.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
//   );

//   // Генерация хеша SHA-256 из пароля для получения ключа
//   const hashBuffer = await crypto.subtle.digest(
//     "SHA-256",
//     encoder.encode(password)
//   );
//   const keyBuffer = hashBuffer.slice(0, 32); // Обрезаем до 256 бит

//   // Импорт ключа для AES-GCM
//   const key = await crypto.subtle.importKey(
//     "raw",
//     keyBuffer,
//     { name: "AES-GCM", length: 256 },
//     false,
//     ["decrypt"]
//   );

//   // Расшифровка данных
//   try {
//     const decryptedData = await crypto.subtle.decrypt(
//       { name: "AES-GCM", iv: iv },
//       key,
//       encryptedFile.encryptedData
//     );
//     return JSON.parse(decoder.decode(decryptedData)); // Возвращаем расшифрованные данные как строку
//   } catch (e) {
//     console.error("Decryption failed:", e);
//     return null; // В случае ошибки возвращаем null
//   }
// }
