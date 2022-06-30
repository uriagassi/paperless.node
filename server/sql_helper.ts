import {Database, Statement} from "better-sqlite3";

export module sql_helper {
  function prepare_one(db:Database, template:string, trigger:string, number:number) {
    return db.prepare(template.replace(trigger, [...Array(number)].map(i => '?').join(',')))
  }

  export function prepare_many(db:Database, template:string, trigger:string, number = 10) {
    const result:Statement[] = []
    for (let i = 0; i <= number; i++) {
      result.push(prepare_one(db, template, trigger, i))
    }
    return (i:number) => get((i:number) => prepare_one(db, template, trigger, i), result, i)
  }

  function get(preparer:(i:number) => Statement, prepared:Statement[], amount:number) : Statement {
    if (amount <= 0) throw "amount should be positive!"
    if (amount < prepared.length - 1) {
      return prepared[amount]
    }
    return preparer(amount)
  }
}
