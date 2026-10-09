import fs from 'fs';

const d = JSON.parse(fs.readFileSync('data/shared_ledger.json', 'utf8'));
console.log('--- ALL ACCOUNTS IN SHARED LEDGER (' + d.rawAccounts.length + ') ---');
d.rawAccounts.forEach((a, i) => {
  console.log(`${i+1}. [${a.type}/${a.subtype}] id: ${a.id} | name: "${a.name}" | mask: "${a.mask}" | bal: $${a.currentBalance} | avail: $${a.availableBalance} | lim: $${a.creditLimit}`);
});
