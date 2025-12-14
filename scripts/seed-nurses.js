const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('../nurses-attendance-firebase-adminsdk-fbsvc-b90e96c054.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = parseCSVLine(lines[i]);
      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index] ? values[index].trim() : '';
      });
      data.push(row);
    }
  }
  return data;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function generatePassword(clinicId) {
  return `Nurse@${clinicId}2024`;
}

async function seedNurses() {
  try {
    console.log('Reading CSV file...');
    const csvPath = path.join(__dirname, '..', 'MAP LOCATOR NEW - Form responses 1.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    console.log('Parsing CSV...');
    const nurses = parseCSV(csvContent);
    console.log(`Found ${nurses.length} records. Processing unique Clinic IDs...`);
    
    const uniqueNurses = new Map();
    for (const nurse of nurses) {
      const clinicId = nurse['Clinic ID'];
      if (clinicId && !uniqueNurses.has(clinicId) && nurse['Status'] === 'ACTIVE') {
        uniqueNurses.set(clinicId, nurse);
      }
    }
    
    console.log(`Found ${uniqueNurses.size} unique active Clinic IDs`);
    
    let createdUsers = 0;
    let createdDocs = 0;
    let errors = 0;
    const batch = [];
    
    for (const [clinicId, nurse] of uniqueNurses) {
      const email = `${clinicId.toLowerCase()}@nurses-attendance.com`;
      const password = generatePassword(clinicId);
      
      const nurseNameField = nurse['Nurse Name and TAB Number'] || '';
      const nameParts = nurseNameField.match(/^([^\d]+)\s*(\d+)?$/);
      const nurseName = nameParts ? nameParts[1].trim() : nurseNameField;
      const nursePhone = nameParts ? nameParts[2] || '' : '';
      
      const nurseData = {
        clinicId: clinicId,
        email: email,
        password: password,
        nurseName: nurseName,
        nursePhone: nursePhone,
        clinicAddress: nurse['Clinic Address'] || '',
        clinicType: nurse['Clinic Type'] || '',
        partnerName: nurse['PARTNERNAME'] || '',
        region: nurse['REGION/DISTRICT'] || '',
        state: nurse['State'] || '',
        agentName: nurse['AGENT NAME & EMP ID'] || '',
        tlName: nurse['TL NAME'] || '',
        dcName: nurse['DC Name and Number'] || '',
        nurseType: nurse['NURSE TYPE '] || '',
        nurseEmpId: nurse['NURSE EMP ID '] || '',
        status: nurse['Status'] || 'ACTIVE',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      batch.push({ clinicId, email, password, nurseData });
    }
    
    console.log('\n=== Saving nurse data to Firestore ===');
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      const currentBatch = batch.slice(i, i + BATCH_SIZE);
      const firestoreBatch = db.batch();
      
      for (const { clinicId, nurseData } of currentBatch) {
        const docRef = db.collection('nurses').doc(clinicId);
        firestoreBatch.set(docRef, nurseData, { merge: true });
      }
      
      await firestoreBatch.commit();
      createdDocs += currentBatch.length;
      console.log(`Saved ${Math.min(i + BATCH_SIZE, batch.length)} of ${batch.length} nurse records`);
    }
    
    console.log(`\n✓ Saved ${createdDocs} nurse records to Firestore`);
    
    console.log('\n=== Creating Firebase Auth users ===');
    console.log(`Processing all ${batch.length} clinics...\n`);
    
    const AUTH_BATCH_SIZE = 10;
    
    for (let i = 0; i < batch.length; i += AUTH_BATCH_SIZE) {
      const currentBatch = batch.slice(i, i + AUTH_BATCH_SIZE);
      
      await Promise.all(currentBatch.map(async ({ clinicId, email, password, nurseData }) => {
        try {
          try {
            await auth.getUserByEmail(email);
            console.log(`  ✓ User ${clinicId} already exists`);
            createdUsers++;
          } catch (e) {
            await auth.createUser({
              email: email,
              password: password,
              displayName: nurseData.nurseName,
              disabled: false
            });
            console.log(`  ✓ Created user: ${clinicId}`);
            createdUsers++;
          }
        } catch (error) {
          console.error(`  ✗ Error creating ${clinicId}: ${error.message}`);
          errors++;
        }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if ((i + AUTH_BATCH_SIZE) % 50 === 0 || i + AUTH_BATCH_SIZE >= batch.length) {
        console.log(`\n  Progress: ${Math.min(i + AUTH_BATCH_SIZE, batch.length)} / ${batch.length} users processed`);
      }
    }
    
    console.log('\n========================================');
    console.log('=== Seeding Complete ===');
    console.log('========================================');
    console.log(`Firestore records: ${createdDocs}`);
    console.log(`Auth users created: ${createdUsers}`);
    console.log(`Auth errors: ${errors}`);
    
    console.log('\n=== Sample Login Credentials ===\n');
    for (let i = 0; i < Math.min(10, batch.length); i++) {
      const { clinicId, password } = batch[i];
      console.log(`${i + 1}. Clinic ID: ${clinicId} | Password: ${password}`);
    }
    
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    process.exit(0);
  }
}

seedNurses();
