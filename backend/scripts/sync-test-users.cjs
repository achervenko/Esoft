const { Client } = require('pg');

const people = [
  {
    username: 'admin',
    lastName: 'Червенко',
    firstName: 'Алехандро',
    middleName: 'Алехандрович',
    position: 'Менеджер по качеству',
  },
  {
    username: 'chief_engineer',
    lastName: 'Смирнов',
    firstName: 'Игорь',
    middleName: 'Павлович',
    position: 'Главный инженер',
  },
  {
    username: 'engineer',
    lastName: 'Кузнецова',
    firstName: 'Марина',
    middleName: 'Сергеевна',
    position: 'Инженер',
  },
  {
    username: 'operator',
    lastName: 'Орлов',
    firstName: 'Дмитрий',
    middleName: 'Андреевич',
    position: 'Оператор оборудования',
  },
  {
    username: 'auditor',
    lastName: 'Белова',
    firstName: 'Анна',
    middleName: 'Викторовна',
    position: 'Аудитор',
  },
];

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  await client.query('begin');

  for (const person of people) {
    const result = await client.query(
      `update employees e
       set last_name = $1,
           first_name = $2,
           middle_name = $3,
           position = $4
       from employee_users eu
       join "user" u on u.id = eu.user_id
       where e.id = eu.employee_id
         and u.username = $5
       returning e.id`,
      [
        person.lastName,
        person.firstName,
        person.middleName,
        person.position,
        person.username,
      ],
    );

    if (result.rowCount !== 1) {
      throw new Error(`Employee link was not found for ${person.username}`);
    }
  }

  await client.query('commit');
}

main()
  .catch(async (error) => {
    try {
      await client.query('rollback');
    } catch {}
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
