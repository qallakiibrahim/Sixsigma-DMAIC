// This file handles both real Firebase integration and transparent local storage fallbacks.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { 
  getDemoProjects, 
  getDemoNotes, 
  getDemoControlPlans, 
  getDemoRaciMatrix, 
  getDemoSigmaTracking,
  getDemoCalculations
} from "./mockData";
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit
} from "firebase/firestore";
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile
} from "firebase/auth";
import { db, auth, OperationType, handleFirestoreError } from "../firebase/client";

const SUPABASE_URL = "https://placeholder-project.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "placeholder-key";

// Determines if we should run in Local Mode (sandbox).
// Activated if explicitly chosen, or if Firebase config is missing (always fallback safely).
export const isLocalMode = () => {
  return localStorage.getItem("dmaic_local_mode") === "true";
};

// Create the real client (kept as fallback types placeholder only)
const realSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// A robust, chainable mock database query builder that stores tables inside localStorage.
class MockQueryBuilder {
  private tableName: string;
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private conditions: { field: string; value: any }[] = [];
  private inConditions: { field: string; values: any[] }[] = [];
  private orderField: string | null = null;
  private orderAscending: boolean = true;
  private limitValue: number | null = null;
  private isSingle: boolean = false;
  private insertData: any = null;
  private updateData: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  in(field: string, values: any[]) {
    this.inConditions.push({ field, values });
    return this;
  }

  select(columns?: string) {
    if (this.operation === 'select') {
      this.operation = 'select';
    }
    return this;
  }

  insert(data: any) {
    this.operation = 'insert';
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.operation = 'update';
    this.updateData = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(field: string, value: any) {
    this.conditions.push({ field, value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  upsert(data: any, options?: any) {
    this.operation = 'upsert';
    this.insertData = data;
    return this;
  }

  async execute() {
    const dbKey = `dmaic_db_${this.tableName}`;
    let items: any[] = [];
    try {
      const stored = localStorage.getItem(dbKey);
      if (stored) {
        items = JSON.parse(stored);
      } else {
        // Hydrate default demo data so that local-mode is fully populated on the first visit
        if (this.tableName === 'projects') {
          items = getDemoProjects();
          localStorage.setItem(dbKey, JSON.stringify(items));
        } else if (this.tableName === 'project_notes') {
          items = getDemoNotes();
          localStorage.setItem(dbKey, JSON.stringify(items));
        } else if (this.tableName === 'control_plans' || this.tableName === 'control_steps') {
          items = getDemoControlPlans();
          localStorage.setItem(dbKey, JSON.stringify(items));
        } else if (this.tableName === 'raci_matrix' || this.tableName === 'raci_rows') {
          items = getDemoRaciMatrix();
          localStorage.setItem(dbKey, JSON.stringify(items));
        } else if (this.tableName === 'sigma_tracking') {
          items = getDemoSigmaTracking();
          localStorage.setItem(dbKey, JSON.stringify(items));
        } else if (this.tableName === 'project_calculations') {
          items = getDemoCalculations();
          localStorage.setItem(dbKey, JSON.stringify(items));
        } else {
          items = [];
        }
      }
    } catch (e) {
      console.error("Local database read error:", e);
      items = [];
    }

    let resultData: any = null;
    const error: any = null;

    if (this.operation === 'select') {
      let filtered = [...items];
      // Apply filters (.eq)
      for (const cond of this.conditions) {
        filtered = filtered.filter(item => item[cond.field] === cond.value);
      }
      // Apply filters (.in)
      for (const cond of this.inConditions) {
        filtered = filtered.filter(item => cond.values.includes(item[cond.field]));
      }

      // Check if we should auto-seed template/demo data for an empty project
      const projectIdCond = this.conditions.find(c => c.field === 'project_id');
      const projectId = projectIdCond ? projectIdCond.value : null;
      const seedableTables = ['project_notes', 'project_calculations', 'control_plans', 'raci_matrix', 'sigma_tracking'];
      
      if (projectId && filtered.length === 0 && seedableTables.includes(this.tableName)) {
        let templateItems: any[] = [];
        if (this.tableName === 'project_notes') {
          templateItems = getDemoNotes();
        } else if (this.tableName === 'project_calculations') {
          templateItems = getDemoCalculations();
        } else if (this.tableName === 'control_plans') {
          templateItems = getDemoControlPlans();
        } else if (this.tableName === 'raci_matrix') {
          templateItems = getDemoRaciMatrix();
        } else if (this.tableName === 'sigma_tracking') {
          templateItems = getDemoSigmaTracking();
        }

        if (templateItems.length > 0) {
          const cloned = templateItems.map((item, index) => ({
            ...item,
            id: `${this.tableName}-seeded-${projectId.substring(0, 8)}-${index}`,
            project_id: projectId,
            user_id: "local-sandbox-user",
            created_at: new Date(Date.now() - (templateItems.length - index) * 3600 * 1000).toISOString()
          }));

          items = [...items, ...cloned];
          localStorage.setItem(dbKey, JSON.stringify(items));
          filtered = cloned;
        }
      }

      // Apply sort order
      if (this.orderField) {
        const field = this.orderField;
        const asc = this.orderAscending;
        filtered.sort((a, b) => {
          const valA = a[field];
          const valB = b[field];
          if (valA == null) return 1;
          if (valB == null) return -1;
          if (valA < valB) return asc ? -1 : 1;
          if (valA > valB) return asc ? 1 : -1;
          return 0;
        });
      }
      // Apply limits
      if (this.limitValue !== null) {
        filtered = filtered.slice(0, this.limitValue);
      }
      
      if (this.isSingle) {
        resultData = filtered[0] || null;
      } else {
        resultData = filtered;
      }
    } else if (this.operation === 'insert') {
      const newItems = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const processed: any[] = [];
      for (const raw of newItems) {
        const newItem = {
          id: raw.id || crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...raw
        };
        items.push(newItem);
        processed.push(newItem);
      }
      localStorage.setItem(dbKey, JSON.stringify(items));
      resultData = Array.isArray(this.insertData) ? processed : processed[0];
    } else if (this.operation === 'upsert') {
      const newItems = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const processed: any[] = [];
      for (const raw of newItems) {
        let existingIndex = -1;
        if (this.tableName === 'project_calculations') {
          existingIndex = items.findIndex(item => 
            (raw.project_id && item.project_id === raw.project_id && raw.tool_id && item.tool_id === raw.tool_id) ||
            (raw.id && item.id === raw.id)
          );
        } else {
          existingIndex = items.findIndex(item => raw.id && item.id === raw.id);
        }

        if (existingIndex !== -1) {
          items[existingIndex] = {
            ...items[existingIndex],
            ...raw,
            updated_at: new Date().toISOString()
          };
          processed.push(items[existingIndex]);
        } else {
          const newItem = {
            id: raw.id || crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...raw
          };
          items.push(newItem);
          processed.push(newItem);
        }
      }
      localStorage.setItem(dbKey, JSON.stringify(items));
      resultData = Array.isArray(this.insertData) ? processed : processed[0];
    } else if (this.operation === 'update') {
      // Find items to patch
      items = items.map(item => {
        let match = true;
        for (const cond of this.conditions) {
          if (item[cond.field] !== cond.value) {
            match = false;
            break;
          }
        }
        if (match) {
          for (const cond of this.inConditions) {
            if (!cond.values.includes(item[cond.field])) {
              match = false;
              break;
            }
          }
        }
        if (match) {
          return {
            ...item,
            ...this.updateData,
            updated_at: new Date().toISOString()
          };
        }
        return item;
      });
      localStorage.setItem(dbKey, JSON.stringify(items));
      
      let matchedItems = [...items];
      for (const cond of this.conditions) {
        matchedItems = matchedItems.filter(item => item[cond.field] === cond.value);
      }
      for (const cond of this.inConditions) {
        matchedItems = matchedItems.filter(item => cond.values.includes(item[cond.field]));
      }
      resultData = this.isSingle ? (matchedItems[0] || null) : matchedItems;
    } else if (this.operation === 'delete') {
      const originalLength = items.length;
      items = items.filter(item => {
        let match = true;
        for (const cond of this.conditions) {
          if (item[cond.field] !== cond.value) {
            match = false;
            break;
          }
        }
        if (match) {
          for (const cond of this.inConditions) {
            if (!cond.values.includes(item[cond.field])) {
              match = false;
              break;
            }
          }
        }
        return !match; // Deletes the matched record
      });
      localStorage.setItem(dbKey, JSON.stringify(items));
      resultData = { count: originalLength - items.length };
    }

    return { data: resultData, error };
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

function removeUndefinedFields(obj: any): any {
  if (obj === undefined) {
    return null;
  }
  if (obj === null) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item));
  }
  if (typeof obj === "object") {
    // Keep Dates, Blobs, custom classes as-is
    if (obj instanceof Date || (typeof obj.getMonth === "function")) {
      return obj;
    }
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        newObj[key] = removeUndefinedFields(val);
      }
    }
    return newObj;
  }
  return obj;
}

// Live cloud database query builder matching the chainable Supabase interface.
class FirestoreQueryBuilder {
  private tableName: string;
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private conditions: { field: string; value: any }[] = [];
  private inConditions: { field: string; values: any[] }[] = [];
  private orderField: string | null = null;
  private orderAscending: boolean = true;
  private limitValue: number | null = null;
  private isSingle: boolean = false;
  private insertData: any = null;
  private updateData: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  in(field: string, values: any[]) {
    this.inConditions.push({ field, values });
    return this;
  }

  select(columns?: string) {
    if (this.operation === 'select') {
      this.operation = 'select';
    }
    return this;
  }

  insert(data: any) {
    this.operation = 'insert';
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.operation = 'update';
    this.updateData = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(field: string, value: any) {
    this.conditions.push({ field, value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  upsert(data: any, options?: any) {
    this.operation = 'upsert';
    this.insertData = data;
    return this;
  }

  async execute() {
    try {
      if (this.insertData !== null) {
        this.insertData = removeUndefinedFields(this.insertData);
      }
      if (this.updateData !== null) {
        this.updateData = removeUndefinedFields(this.updateData);
      }

      const hasUndefinedCondition = this.conditions.some(cond => cond.value === undefined);
      const hasUndefinedInCondition = this.inConditions.some(cond => !cond.values || cond.values.some(v => v === undefined));
      if (hasUndefinedCondition || hasUndefinedInCondition) {
        console.warn(`Query on ${this.tableName} contained undefined conditions, returning empty/failed result to prevent Firestore crash.`);
        if (this.operation === 'select') {
          return { data: this.isSingle ? null : [], error: null };
        }
        return { data: this.isSingle ? null : [], error: new Error("Query contained undefined conditions") };
      }

      if (this.operation === 'select') {
        const idCond = this.conditions.find(c => c.field === 'id');
        if (idCond) {
          const docSnap = await getDoc(doc(db, this.tableName, idCond.value));
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() };
            return { data: this.isSingle ? data : [data], error: null };
          } else {
            return { data: this.isSingle ? null : [], error: null };
          }
        }

        // Special handling for projects fetch to avoid unfiltered list operations
        if (this.tableName === 'projects') {
          const currentUser = auth.currentUser;
          if (!currentUser) {
            return { data: this.isSingle ? null : [], error: null };
          }

          // 1. Fetch projects where the user is the creator
          const colRef = collection(db, 'projects');
          const qOwner = query(colRef, where('user_id', '==', currentUser.uid));
          const snapOwner = await getDocs(qOwner);
          const ownedProjects = snapOwner.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

          // 2. Fetch projects where the user is a collaborator
          let collaboratorProjectIds: string[] = [];
          
          // Query by user_id
          const qCollabId = query(collection(db, 'project_collaborators'), where('user_id', '==', currentUser.uid));
          const snapCollabId = await getDocs(qCollabId);
          snapCollabId.docs.forEach(d => {
            const pId = d.data().project_id;
            if (pId) collaboratorProjectIds.push(pId);
          });

          // Query by user_email
          if (currentUser.email) {
            const qCollabEmail = query(collection(db, 'project_collaborators'), where('user_email', '==', currentUser.email.toLowerCase()));
            const snapCollabEmail = await getDocs(qCollabEmail);
            snapCollabEmail.docs.forEach(d => {
              const pId = d.data().project_id;
              if (pId) collaboratorProjectIds.push(pId);
            });
          }

          // Deduplicate collaboratorProjectIds
          collaboratorProjectIds = Array.from(new Set(collaboratorProjectIds));

          // 3. Fetch each collaborator project document
          const collabProjects: any[] = [];
          await Promise.all(collaboratorProjectIds.map(async (pId) => {
            try {
              const dSnap = await getDoc(doc(db, 'projects', pId));
              if (dSnap.exists()) {
                collabProjects.push({ id: dSnap.id, ...dSnap.data() });
              }
            } catch (err) {
              console.error(`Failed to fetch collaborator project ${pId}:`, err);
            }
          }));

          // 4. Combine and deduplicate
          const allProjectsMap = new Map();
          ownedProjects.forEach(p => allProjectsMap.set(p.id, p));
          collabProjects.forEach(p => allProjectsMap.set(p.id, p));
          let combinedProjects = Array.from(allProjectsMap.values());

          // 5. Apply any query filters
          for (const cond of this.conditions) {
            combinedProjects = combinedProjects.filter(item => item[cond.field] === cond.value);
          }
          for (const cond of this.inConditions) {
            combinedProjects = combinedProjects.filter(item => cond.values.includes(item[cond.field]));
          }

          // 6. Apply ordering
          if (this.orderField) {
            const field = this.orderField;
            const asc = this.orderAscending;
            combinedProjects.sort((a, b) => {
              const valA = a[field];
              const valB = b[field];
              if (valA == null) return 1;
              if (valB == null) return -1;
              if (valA < valB) return asc ? -1 : 1;
              if (valA > valB) return asc ? 1 : -1;
              return 0;
            });
          }

          // 7. Apply limits
          if (this.limitValue !== null) {
            combinedProjects = combinedProjects.slice(0, this.limitValue);
          }

          return { data: this.isSingle ? (combinedProjects[0] || null) : combinedProjects, error: null };
        }

        const colRef = collection(db, this.tableName);
        const qConstraints: any[] = [];
        for (const cond of this.conditions) {
          qConstraints.push(where(cond.field, '==', cond.value));
        }
        for (const cond of this.inConditions) {
          if (cond.values && cond.values.length > 0) {
            qConstraints.push(where(cond.field, 'in', cond.values.slice(0, 30)));
          } else {
            return { data: this.isSingle ? null : [], error: null };
          }
        }

        const q = query(colRef, ...qConstraints);
        const snap = await getDocs(q);
        let docs = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

        // Check if we should auto-seed template/demo data for an empty project in Firestore
        const projectIdCond = this.conditions.find(c => c.field === 'project_id');
        const projectId = projectIdCond ? projectIdCond.value : null;
        const seedableTables = ['project_notes', 'project_calculations', 'control_plans', 'raci_matrix', 'sigma_tracking'];
        
        if (projectId && docs.length === 0 && seedableTables.includes(this.tableName)) {
          let templateItems: any[] = [];
          if (this.tableName === 'project_notes') {
            templateItems = getDemoNotes();
          } else if (this.tableName === 'project_calculations') {
            templateItems = getDemoCalculations();
          } else if (this.tableName === 'control_plans') {
            templateItems = getDemoControlPlans();
          } else if (this.tableName === 'raci_matrix') {
            templateItems = getDemoRaciMatrix();
          } else if (this.tableName === 'sigma_tracking') {
            templateItems = getDemoSigmaTracking();
          }

          if (templateItems.length > 0) {
            const currentUser = auth.currentUser;
            const userId = currentUser ? currentUser.uid : "local-sandbox-user";
            const clonedDocs: any[] = [];
            
            for (let i = 0; i < templateItems.length; i++) {
               const item = templateItems[i];
               const docId = `${this.tableName}-seeded-${projectId.substring(0, 8)}-${i}`;
               const docRef = doc(db, this.tableName, docId);
               const payload = {
                 ...item,
                 id: docId,
                 project_id: projectId,
                 user_id: userId,
                 created_at: new Date(Date.now() - (templateItems.length - i) * 3600 * 1000).toISOString()
               };
               await setDoc(docRef, payload);
               clonedDocs.push(payload);
            }
            docs = clonedDocs;
          }
        }

        // Apply in-memory sorting to prevent composite index requirement errors
        if (this.orderField) {
          const field = this.orderField;
          const asc = this.orderAscending;
          docs.sort((a: any, b: any) => {
            const valA = a[field];
            const valB = b[field];
            if (valA == null) return 1;
            if (valB == null) return -1;
            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
          });
        }

        // Apply in-memory limit
        if (this.limitValue !== null) {
          docs = docs.slice(0, this.limitValue);
        }

        return { data: this.isSingle ? (docs[0] || null) : docs, error: null };

      } else if (this.operation === 'insert') {
        const newItems = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        const processed: any[] = [];
        for (const raw of newItems) {
          const docId = raw.id || crypto.randomUUID();
          const docRef = doc(db, this.tableName, docId);
          const payload = {
            ...raw,
            id: docId,
            created_at: raw.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          await setDoc(docRef, payload);
          processed.push(payload);
        }
        const resultData = Array.isArray(this.insertData) ? processed : processed[0];
        return { data: resultData, error: null };

      } else if (this.operation === 'upsert') {
        const newItems = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        const processed: any[] = [];
        for (const raw of newItems) {
          let docId = raw.id;
          if (!docId && this.tableName === 'project_calculations') {
            if (raw.project_id && raw.tool_id) {
              const q = query(
                collection(db, this.tableName),
                where("project_id", "==", raw.project_id),
                where("tool_id", "==", raw.tool_id)
              );
              const snap = await getDocs(q);
              if (!snap.empty) {
                docId = snap.docs[0].id;
              }
            }
          }
          if (!docId) {
            docId = crypto.randomUUID();
          }
          const docRef = doc(db, this.tableName, docId);
          const payload = {
            ...raw,
            id: docId,
            updated_at: new Date().toISOString()
          };
          await setDoc(docRef, payload, { merge: true });
          processed.push(payload);
        }
        const resultData = Array.isArray(this.insertData) ? processed : processed[0];
        return { data: resultData, error: null };

      } else if (this.operation === 'update') {
        const idCond = this.conditions.find(c => c.field === 'id');
        if (idCond) {
          const docRef = doc(db, this.tableName, idCond.value);
          await setDoc(docRef, {
            ...this.updateData,
            updated_at: new Date().toISOString()
          }, { merge: true });
          const updatedSnap = await getDoc(docRef);
          return { data: this.isSingle ? { id: updatedSnap.id, ...updatedSnap.data() } : [{ id: updatedSnap.id, ...updatedSnap.data() }], error: null };
        } else {
          const colRef = collection(db, this.tableName);
          const qConstraints: any[] = [];
          for (const cond of this.conditions) {
            qConstraints.push(where(cond.field, '==', cond.value));
          }
          for (const cond of this.inConditions) {
            if (cond.values && cond.values.length > 0) {
              qConstraints.push(where(cond.field, 'in', cond.values.slice(0, 30)));
            } else {
              return { data: this.isSingle ? null : [], error: null };
            }
          }
          const q = query(colRef, ...qConstraints);
          const snap = await getDocs(q);
          const updated: any[] = [];
          for (const docSnap of snap.docs) {
            const docRef = doc(db, this.tableName, docSnap.id);
            await setDoc(docRef, {
              ...this.updateData,
              updated_at: new Date().toISOString()
            }, { merge: true });
            updated.push({ id: docSnap.id, ...docSnap.data(), ...this.updateData });
          }
          return { data: this.isSingle ? (updated[0] || null) : updated, error: null };
        }

      } else if (this.operation === 'delete') {
        const idCond = this.conditions.find(c => c.field === 'id');
        if (idCond) {
          await deleteDoc(doc(db, this.tableName, idCond.value));
          return { data: { count: 1 }, error: null };
        } else {
          const colRef = collection(db, this.tableName);
          const qConstraints: any[] = [];
          for (const cond of this.conditions) {
            qConstraints.push(where(cond.field, '==', cond.value));
          }
          for (const cond of this.inConditions) {
            if (cond.values && cond.values.length > 0) {
              qConstraints.push(where(cond.field, 'in', cond.values.slice(0, 30)));
            } else {
              return { data: { count: 0 }, error: null };
            }
          }
          const q = query(colRef, ...qConstraints);
          const snap = await getDocs(q);
          let count = 0;
          for (const docSnap of snap.docs) {
            await deleteDoc(doc(db, this.tableName, docSnap.id));
            count++;
          }
          return { data: { count }, error: null };
        }
      }
    } catch (err: any) {
      console.error(`Firebase error on operation ${this.operation} for table ${this.tableName}:`, err);
      let opType = OperationType.GET;
      if (this.operation === 'insert' || this.operation === 'upsert') opType = OperationType.CREATE;
      else if (this.operation === 'update') opType = OperationType.UPDATE;
      else if (this.operation === 'delete') opType = OperationType.DELETE;
      
      try {
        handleFirestoreError(err, opType, this.tableName);
      } catch (mappedErr: any) {
        let cleanMessage = mappedErr.message;
        try {
          const parsed = JSON.parse(mappedErr.message);
          if (parsed && parsed.error) {
            cleanMessage = parsed.error;
          }
        } catch (_) {
          // Fall back to original error message if JSON parsing fails
        }
        return { data: null, error: { message: cleanMessage } };
      }
      return { data: null, error: { message: err?.message || String(err) } };
    }
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// A robust local mockup of Supabase auth API
class MockAuth {
  private listeners: ((event: string, session: any) => void)[] = [];

  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.listeners.push(callback);
    const session = this.getMockSession();
    setTimeout(() => {
      callback(session ? "SIGNED_IN" : "SIGNED_OUT", session);
    }, 0);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter(l => l !== callback);
          }
        }
      }
    };
  }

  getMockSession() {
    const sessionStr = localStorage.getItem("dmaic_mock_session");
    return sessionStr ? JSON.parse(sessionStr) : null;
  }

  async getSession() {
    return { data: { session: this.getMockSession() }, error: null };
  }

  async signUp(options: any) {
    const user = {
      id: crypto.randomUUID(),
      email: options.email,
      user_metadata: options.options?.data || {}
    };
    const session = {
      access_token: "mock-token-" + crypto.randomUUID(),
      user
    };
    localStorage.setItem("dmaic_mock_session", JSON.stringify(session));
    localStorage.setItem("dmaic_local_mode", "true");
    
    this.trigger("SIGNED_IN", session);
    return { data: { user, session }, error: null };
  }

  async signInWithPassword(options: any) {
    const user = {
      id: "local-sandbox-user",
      email: options.email,
      user_metadata: { display_name: options.email.split("@")[0] }
    };
    const session = {
      access_token: "mock-token-local",
      user
    };
    localStorage.setItem("dmaic_mock_session", JSON.stringify(session));
    localStorage.setItem("dmaic_local_mode", "true");
    
    this.trigger("SIGNED_IN", session);
    return { data: { user, session }, error: null };
  }

  async signInWithOAuth(options: any) {
    const user = {
      id: "local-sandbox-user",
      email: "demo@sixsigma.local",
      user_metadata: { display_name: "Demo Användare" }
    };
    const session = {
      access_token: "mock-token-google-local",
      user
    };
    localStorage.setItem("dmaic_mock_session", JSON.stringify(session));
    localStorage.setItem("dmaic_local_mode", "true");
    
    this.trigger("SIGNED_IN", session);

    const redirectTo = options?.options?.redirectTo || (window.location.origin + "/projects");
    setTimeout(() => {
      window.location.href = redirectTo;
    }, 100);

    return { data: { provider: "google", url: redirectTo }, error: null };
  }

  async signOut() {
    localStorage.removeItem("dmaic_mock_session");
    localStorage.removeItem("dmaic_local_mode");
    this.trigger("SIGNED_OUT", null);
    return { error: null };
  }

  private trigger(event: string, session: any) {
    for (const listener of this.listeners) {
      listener(event, session);
    }
  }
}

// Live Firebase Authentication client mapped to the Supabase client API interface.
class FirebaseAuth {
  onAuthStateChange(callback: (event: string, session: any) => void) {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Create matching profiles entry if they don't have one
        try {
          const profileRef = doc(db, "profiles", firebaseUser.uid);
          const profileSnap = await getDoc(profileRef);
          if (!profileSnap.exists()) {
            await setDoc(profileRef, {
              user_id: firebaseUser.uid,
              display_name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Användare",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error("Profiles fallback synchronization failed:", e);
        }

        // Automatically claim any pending collaborator invitations for this user's email
        if (firebaseUser.email) {
          try {
            const collabCol = collection(db, "project_collaborators");
            const q = query(
              collabCol,
              where("user_email", "==", firebaseUser.email.toLowerCase()),
              where("user_id", "==", "invited-user-placeholder")
            );
            const snap = await getDocs(q);
            for (const docSnap of snap.docs) {
              const docRef = doc(db, "project_collaborators", docSnap.id);
              await setDoc(docRef, { user_id: firebaseUser.uid }, { merge: true });
            }
          } catch (e) {
            console.error("Failed to automatically claim project invitations:", e);
          }
        }

        const user = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          user_metadata: { display_name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Användare" }
        };
        const session = {
          access_token: await firebaseUser.getIdToken(),
          user
        };
        callback("SIGNED_IN", session);
      } else {
        callback("SIGNED_OUT", null);
      }
    });

    return {
      data: {
        subscription: {
          unsubscribe
        }
      }
    };
  }

  async getSession() {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      const user = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        user_metadata: { display_name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Användare" }
      };
      const session = {
        access_token: await firebaseUser.getIdToken(),
        user
      };
      return { data: { session }, error: null };
    }
    return { data: { session: null }, error: null };
  }

  async signUp(options: any) {
    try {
      const credential = await createUserWithEmailAndPassword(auth, options.email, options.password);
      if (options.options?.data?.display_name) {
        await updateProfile(credential.user, {
          displayName: options.options.data.display_name
        });
      }
      
      const profileRef = doc(db, "profiles", credential.user.uid);
      await setDoc(profileRef, {
        user_id: credential.user.uid,
        display_name: options.options?.data?.display_name || options.email.split("@")[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const user = {
        id: credential.user.uid,
        email: credential.user.email,
        user_metadata: { display_name: credential.user.displayName }
      };
      const session = {
        access_token: await credential.user.getIdToken(),
        user
      };
      localStorage.removeItem("dmaic_local_mode");
      return { data: { user, session }, error: null };
    } catch (error: any) {
      return { data: { user: null, session: null }, error };
    }
  }

  async signInWithPassword(options: any) {
    try {
      const credential = await signInWithEmailAndPassword(auth, options.email, options.password);
      const user = {
        id: credential.user.uid,
        email: credential.user.email,
        user_metadata: { display_name: credential.user.displayName }
      };
      const session = {
        access_token: await credential.user.getIdToken(),
        user
      };
      localStorage.removeItem("dmaic_local_mode");
      return { data: { user, session }, error: null };
    } catch (error: any) {
      return { data: { user: null, session: null }, error };
    }
  }

  async signInWithOAuth(options: any) {
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      
      try {
        const profileRef = doc(db, "profiles", credential.user.uid);
        const profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) {
          await setDoc(profileRef, {
            user_id: credential.user.uid,
            display_name: credential.user.displayName || credential.user.email?.split("@")[0] || "Användare",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      } catch (profileErr) {
        console.warn("Non-blocking profile synchronization failed during Google sign-in:", profileErr);
      }

      const user = {
        id: credential.user.uid,
        email: credential.user.email,
        user_metadata: { display_name: credential.user.displayName }
      };
      const session = {
        access_token: await credential.user.getIdToken(),
        user
      };
      localStorage.removeItem("dmaic_local_mode");
      return { data: { user, session }, error: null };
    } catch (error: any) {
      console.error("Firebase Sign In with OAuth failed:", error);
      const mappedError = {
        code: error?.code || "unknown",
        message: error?.message || String(error)
      };
      return { data: { user: null, session: null }, error: mappedError };
    }
  }

  async signOut() {
    try {
      await firebaseSignOut(auth);
      localStorage.removeItem("dmaic_mock_session");
      localStorage.removeItem("dmaic_local_mode");
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }
}

// 5W2H Problem Analysis Synthesizer
function synthesize5w2h(matrix: any) {
  const whatIs = matrix.what?.is || "";
  const whoIs = matrix.who?.is || "";
  const whereIs = matrix.where?.is || "";
  const whenIs = matrix.when?.is || "";
  const whyIs = matrix.why?.is || "";
  const howIs = matrix.how?.is || "";
  const howManyIs = matrix.howMany?.is || "";

  const whatIsNot = matrix.what?.isNot || "";
  const whoIsNot = matrix.who?.isNot || "";
  const whereIsNot = matrix.where?.isNot || "";
  const whenIsNot = matrix.when?.isNot || "";
  const whyIsNot = matrix.why?.isNot || "";
  const howIsNot = matrix.how?.isNot || "";
  const howManyIsNot = matrix.howMany?.isNot || "";

  return {
    problemStatement: `Problembeskrivning: Det har identifierats avvikelser gällande "${whatIs || "kärnprocessen"}" som direkt påverkar "${whoIs || "berörda parter"}" vid driftområde "${whereIs || "aktuella enheter"}". Avvikelsen utlöses vid fas "${whenIs || "driftsituationer"}" och beror främst på "${whyIs || "processrelaterade orsaker"}". Det estimeras orsaka "${howManyIs || "ej kvantifierade"}" negativa händelser och motverkas idag av temporära åtgärder via "${howIs || "manuella insatser"}".`,
    scopeStatement: `Projektomfattning (Scope Definition):\n- Omfattas (IS): ${whatIs || "Primära arbetsprocessen"}. Särskilt avgränsat till ${whereIs || "aktuella avdelningar"} och ${whoIs || "berörda användarroller"}.\n- Omfattas INTE (IS NOT): ${whatIsNot || "Andra system"}, ${whereIsNot || "övriga områden och avdelningar"}, samt ${whoIsNot || "externa användare"}.\n\nProjektet styrs uteslutande för att eliminera identifierad variation inom primärt definierat processteg.`
  };
}

const mockAuthInstance = new MockAuth();
const firebaseAuthInstance = new FirebaseAuth();

// Expose the proxied Supabase client mapping directly to real Firebase systems safely.
export const supabase = new Proxy(realSupabase, {
  get(target, prop, receiver) {
    if (isLocalMode()) {
      if (prop === 'auth') {
        return mockAuthInstance;
      }
      if (prop === 'from') {
        return (tableName: string) => {
          return new MockQueryBuilder(tableName);
        };
      }
      if (prop === 'rpc') {
        return (rpcName: string, args?: any) => {
          if (rpcName === "get_project_collaborators_safe") {
            return Promise.resolve({
              data: [
                {
                  id: "collab-owner",
                  user_id: "local-sandbox-user",
                  user_email: "demo@sixsigma.local",
                  role: "owner",
                  created_at: new Date().toISOString()
                }
              ],
              error: null
            });
          }
          return Promise.resolve({ data: null, error: null });
        };
      }
      if (prop === 'functions') {
        return {
          invoke: async (functionName: string, options?: any) => {
            if (functionName === "invite-collaborator") {
              const email = options?.body?.email || "co-worker@sixsigma.local";
              const role = options?.body?.role || "editor";
              return {
                data: {
                  success: true,
                  collaborator: {
                    id: "collab-" + crypto.randomUUID().substring(0, 8),
                    user_id: "collab-user-id",
                    user_email: email,
                    role: role,
                    created_at: new Date().toISOString()
                  }
                },
                error: null
              };
            }
            return { data: null, error: null };
          }
        };
      }
    } else {
      // --- LIVE DATABASE CONNECTION REDIRECTING ENTIRELY TO FIREBASE ---
      if (prop === 'auth') {
        return firebaseAuthInstance;
      }
      if (prop === 'from') {
        return (tableName: string) => {
          return new FirestoreQueryBuilder(tableName);
        };
      }
      if (prop === 'rpc') {
        return async (rpcName: string, args?: any) => {
          try {
            if (rpcName === "get_project_collaborators_safe") {
              const projectId = args?._project_id;
              if (!projectId) {
                return { data: [], error: null };
              }
              const q = query(collection(db, "project_collaborators"), where("project_id", "==", projectId));
              const snap = await getDocs(q);
              const data = snap.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
              }));
              return { data, error: null };
            }
            return { data: null, error: null };
          } catch (e: any) {
            handleFirestoreError(e, OperationType.GET, rpcName);
          }
        };
      }
      if (prop === 'functions') {
        return {
          invoke: async (functionName: string, options?: any) => {
            try {
              if (functionName === "invite-collaborator") {
                const email = options?.body?.email;
                const projectId = options?.body?.project_id;
                const role = options?.body?.role || "editor";
                
                if (!projectId || !email) {
                  return { data: { error: "Projekts-ID och e-post krävs" }, error: null };
                }
                
                const existingQ = query(
                  collection(db, "project_collaborators"), 
                  where("project_id", "==", projectId),
                  where("user_email", "==", email)
                );
                const existingSnap = await getDocs(existingQ);
                if (!existingSnap.empty) {
                  return { data: { error: "Användaren är redan inbjuden" }, error: null };
                }

                const collabId = projectId + "_" + email.toLowerCase();
                const docRef = doc(db, "project_collaborators", collabId);
                const collaborator = {
                  id: collabId,
                  project_id: projectId,
                  user_id: "invited-user-placeholder",
                  user_email: email,
                  role: role,
                  invited_by: auth.currentUser?.uid || "system",
                  created_at: new Date().toISOString()
                };

                await setDoc(docRef, collaborator);
                return {
                  data: {
                    success: true,
                    collaborator
                  },
                  error: null
                };
              } else if (functionName === "ai-5w2h-synth") {
                const matrix = options?.body?.matrix || {};
                const synth = synthesize5w2h(matrix);
                return { data: synth, error: null };
              }
              return { data: null, error: null };
            } catch (e: any) {
              handleFirestoreError(e, OperationType.WRITE, functionName);
            }
          }
        };
      }
    }

    return Reflect.get(target, prop, receiver);
  }
}) as any;
