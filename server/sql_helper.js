(function() {

  function prepare_one(db, template, trigger, number) {
    return db.prepare(template.replace(trigger, [...Array(number)].map(i => '?').join(',')))
  }

  module.exports.prepare_many = (db, template, trigger, number = 10) => {
    const result = [(i) => prepare_one(db, template, trigger, i)]
    for (let i = 1; i <= number; i++) {
      result.push(prepare_one(db, template, trigger, i))
    }
    return (i) => get(result, i)
  }

  function get(prepared, amount) {
    if (amount <= 0) return undefined;
    if (amount < prepared.length - 1) {
      return prepared[amount]
    }
    return prepared[0](amount)
  }
})()
