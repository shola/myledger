const fs = require('fs');
const parse = require('csv-parse');

class CsvRow {
    constructor([debtor, totalAmount, ...creditors]) {
        this.debtor = debtor;
        this.creditors = creditors;
        this.amount = Math.floor(parseInt(totalAmount) / creditors.length);
    }
}

class Transaction {
    constructor([debtor, creditor, amount]) {
        this.debtor = debtor;
        this.creditor = creditor;
        this.amount = amount;
    }
    toString() {
        return `${this.creditor} owes ${this.amount} ${this.debtor}`;
    }
}

class Ledger {
    constructor() {
        this.accounts = {};
        this.transactions = [];
    }
    async init(inputFile = './transactions.csv') {
        const inputStream = await fs.createReadStream(inputFile);
        const parsedCsv = await inputStream.pipe(parse({ relax_column_count: true }));
        const txReconciled = await parsedCsv.on('data', values => {
            const row = new CsvRow(values);
            row.creditors.forEach(c =>
                this.reconcile(new Transaction([row.debtor, c, row.amount]))
            );
        });
        const settled = await txReconciled.on('end', () => this.settle());
        return settled;
    }
    reconcile(t) {
        this.updateOrCreateAccount(t.creditor, t.amount);
        this.updateOrCreateAccount(t.debtor, -t.amount);
    }
    updateOrCreateAccount(name, amount) {
        if (name in this.accounts) {
            this.accounts[name] += amount;
        } else {
            this.accounts[name] = amount;
        }
    }
    settle() {
        let maxCreditor = this.maxCreditor;
        let maxDebtor = this.maxDebtor;

        while (maxCreditor.amount !== 0 && maxDebtor.amount !== 0) {
            // Math.abs(maxDebtor.amount) > maxCreditor.amount:
            // - debtor greedily accepts all of creditors payments
            // Math.abs(maxDebtor.amount) < maxCreditor.amount:
            // - creditor generously pays off all of debtor lent money

            const settlementAmount = Math.min(maxCreditor.amount, Math.abs(maxDebtor.amount));
            this.accounts[maxCreditor.name] -= settlementAmount;
            this.accounts[maxDebtor.name] += settlementAmount;
            this.transactions.push(
                new Transaction([maxDebtor.name, maxCreditor.name, settlementAmount])
            );

            // get new maxCreditor and maxDebtor
            maxCreditor = this.maxCreditor;
            maxDebtor = this.maxDebtor;
        }

        this.printTransactions();
    }
    printTransactions() {
        const len = this.transactions.length;
        let counter = 1;

        console.log(`\nIt will take (${len}) transactions to settle all credits/debts:`);
        this.transactions.forEach(t => console.log(`${counter++}) ${t.toString()}`));
    }
    // ACCESSOR METHODS
    get settlementTransactions() {
        if (this.transactions.length > 0) {
            return this.transactions;
        } else {
            return undefined;
        }
    }
    get debtors() {
        const keys = Object.keys(this.accounts);
        let debtors = {};
        keys.forEach(key => {
            if (this.accounts[key] < 0) {
                debtors[key] = this.accounts[key];
            }
        });
        return debtors;
    }
    get creditors() {
        const keys = Object.keys(this.accounts);
        let creditors = {};
        keys.forEach(key => {
            if (this.accounts[key] > 0) {
                creditors[key] = this.accounts[key];
            }
        });
        return creditors;
    }
    get maxCreditor() {
        const creditors = this.creditors;
        const max = { name: undefined, amount: 0 };

        for (let name in creditors) {
            let amount = creditors[name];
            if (amount > max.amount) {
                max.amount = amount;
                max.name = name;
            }
        }
        return max;
    }
    get maxDebtor() {
        const debtors = this.debtors;
        const max = { name: undefined, amount: 0 };

        for (let name in debtors) {
            let amount = debtors[name];
            if (amount < max.amount) {
                max.amount = amount;
                max.name = name;
            }
        }
        return max;
    }
}

//let ledger = new Ledger();

module.exports = Ledger;
