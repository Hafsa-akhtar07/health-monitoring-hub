const { query } = require('../config/database');

// Sample CBC data over 6 months (showing trends)
const sampleReports = [
  // Month 1 - January
  {
    extracted_data: {
      hemoglobin: 14.2,
      rbc: 4.8,
      wbc: 7.2,
      platelets: 250,
      hematocrit: 42.5,
      mcv: 88,
      mch: 30,
      mchc: 34.5
    },
    created_at: '2024-01-15T10:00:00Z',
    severity: 'normal'
  },
  // Month 2 - February
  {
    extracted_data: {
      hemoglobin: 13.8,
      rbc: 4.7,
      wbc: 6.8,
      platelets: 265,
      hematocrit: 41.8,
      mcv: 89,
      mch: 29.5,
      mchc: 34.2
    },
    created_at: '2024-02-10T10:00:00Z',
    severity: 'normal'
  },
  // Month 3 - March
  {
    extracted_data: {
      hemoglobin: 14.5,
      rbc: 4.9,
      wbc: 7.5,
      platelets: 240,
      hematocrit: 43.2,
      mcv: 88,
      mch: 30.2,
      mchc: 34.8
    },
    created_at: '2024-03-15T10:00:00Z',
    severity: 'normal'
  },
  // Month 4 - April
  {
    extracted_data: {
      hemoglobin: 13.9,
      rbc: 4.6,
      wbc: 7.1,
      platelets: 255,
      hematocrit: 42.0,
      mcv: 87,
      mch: 29.8,
      mchc: 34.0
    },
    created_at: '2024-04-12T10:00:00Z',
    severity: 'normal'
  },
  // Month 5 - May (slight abnormality)
  {
    extracted_data: {
      hemoglobin: 12.8,
      rbc: 4.3,
      wbc: 6.5,
      platelets: 220,
      hematocrit: 39.5,
      mcv: 85,
      mch: 28.5,
      mchc: 33.5
    },
    created_at: '2024-05-18T10:00:00Z',
    severity: 'abnormal'
  },
  // Month 6 - June (recovery)
  {
    extracted_data: {
      hemoglobin: 14.8,
      rbc: 5.0,
      wbc: 7.8,
      platelets: 270,
      hematocrit: 44.0,
      mcv: 90,
      mch: 30.5,
      mchc: 35.0
    },
    created_at: '2024-06-20T10:00:00Z',
    severity: 'normal'
  },
  // Recent - July
  {
    extracted_data: {
      hemoglobin: 14.5,
      rbc: 4.85,
      wbc: 7.3,
      platelets: 260,
      hematocrit: 43.5,
      mcv: 89,
      mch: 30.0,
      mchc: 34.6
    },
    created_at: '2024-07-10T10:00:00Z',
    severity: 'normal'
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Check if data already exists
    const checkResult = await query('SELECT COUNT(*) FROM reports');
    const existingCount = parseInt(checkResult.rows[0].count);

    if (existingCount > 0) {
      console.log(`⚠️  Database already has ${existingCount} reports.`);
      console.log('   To add sample data, you can either:');
      console.log('   1. Delete existing data first');
      console.log('   2. Run this script with --force flag to add sample data anyway');
      
      if (process.argv.includes('--force')) {
        console.log('   Adding sample data anyway (--force flag detected)...');
      } else {
        console.log('   Skipping seed. Use --force to add data anyway.');
        process.exit(0);
      }
    }

    let insertedCount = 0;

    for (const report of sampleReports) {
      // Insert report
      const reportResult = await query(
        `INSERT INTO reports (extracted_data, created_at, filename)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [
          JSON.stringify(report.extracted_data),
          report.created_at,
          `CBC_Report_${new Date(report.created_at).toISOString().split('T')[0]}.pdf`
        ]
      );

      const reportId = reportResult.rows[0].id;

      // Insert analysis
      await query(
        `INSERT INTO analyses (report_id, severity, created_at)
         VALUES ($1, $2, $3)`,
        [reportId, report.severity, report.created_at]
      );

      insertedCount++;
    }

    console.log(`✅ Successfully inserted ${insertedCount} sample reports with analyses!`);
    console.log('   You can now view them in the History & Trends section.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };










