// todo Just for easier testing. Better place should be find and structure improved.

import {
  Cartesian3,
  Matrix3,
  Matrix4,
  Model,
  Quaternion,
  TranslationRotationScale,
} from '@cesium/engine';
import {instantiateModel} from '../../plugins/cesium/ngv-cesium-factories.js';

const DB_NAME = 'uploadedModelsStore';

export function storeBlobInIndexedDB(blob: Blob, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      store.put(blob, name);
      transaction.oncomplete = () => {
        console.log('Blob stored successfully');
        resolve();
      };
      transaction.onerror = () => {
        reject(new Error('Error storing blob'));
      };
    };

    request.onerror = (event) => console.error('IndexedDB error:', event);
  });
}

export function getBlobFromIndexedDB(name: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('files', 'readonly');
      const store = transaction.objectStore('files');
      const getRequest = <IDBRequest<Blob>>store.get(name);

      getRequest.onsuccess = () => {
        const blob = getRequest.result;
        if (blob) {
          resolve(blob); // Return the Blob object directly
        } else {
          reject(new Error('Blob not found'));
        }
      };

      getRequest.onerror = () =>
        reject(new Error('Error retrieving blob from IndexedDB'));
    };

    request.onerror = () => reject(new Error('Error opening IndexedDB'));
  });
}

export function deleteFromIndexedDB(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      const deleteRequest = store.delete(name);

      deleteRequest.onsuccess = () => {
        console.log(`Item with key "${name}" deleted successfully`);
        resolve();
      };

      deleteRequest.onerror = () => {
        console.error('Error deleting item from IndexedDB');
        reject(new Error('Error deleting item from IndexedDB'));
      };
    };

    request.onerror = () => {
      console.error('Error opening IndexedDB');
      reject(new Error('Error opening IndexedDB'));
    };
  });
}

export type StoredModel = {
  name: string;
  min: number[];
  max: number[];
  dimensions: number[];
  translation: number[];
  rotation: number[];
  scale: number[];
};

export const STORE_KEY = 'localStoreModels';

export function updateModelsInLocalStore(models: Model[]): void {
  const localStoreModels: StoredModel[] = [];
  models.forEach((model) => {
    const translation = Matrix4.getTranslation(
      model.modelMatrix,
      new Cartesian3(),
    );
    const scale = Matrix4.getScale(model.modelMatrix, new Cartesian3());
    const rotation = Quaternion.fromRotationMatrix(
      Matrix4.getRotation(model.modelMatrix, new Matrix3()),
    );
    localStoreModels.push({
      name: model.id.name,
      min: [model.id.min.x, model.id.min.y, model.id.min.z],
      max: [model.id.max.x, model.id.max.y, model.id.max.z],
      dimensions: [
        model.id.dimensions.x,
        model.id.dimensions.y,
        model.id.dimensions.z,
      ],
      translation: [translation.x, translation.y, translation.z],
      rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
      scale: [scale.x, scale.y, scale.z],
    });
  });
  localStorage.setItem(STORE_KEY, JSON.stringify(localStoreModels));
}

export function getStoredModels(): StoredModel[] {
  if (!localStorage.getItem(STORE_KEY)) return [];
  try {
    return <StoredModel[]>JSON.parse(localStorage.getItem(STORE_KEY));
  } catch (e) {
    console.error('Not possible to parse models from local storage', e);
    return [];
  }
}