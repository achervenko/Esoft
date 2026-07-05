const { Client } = require('./backend/node_modules/pg');

const users = [
  {
    username: 'chief_engineer',
    email: 'chief.engineer@esoft.local',
    password: 'chief12345',
    role: 'chief_engineer',
    name: 'Смирнов Игорь Павлович',
    lastName: 'Смирнов',
    firstName: 'Игорь',
    middleName: 'Павлович',
    position: 'Главный инженер',
  },
  {
    username: 'engineer',
    email: 'engineer@esoft.local',
    password: 'engineer12345',
    role: 'engineer',
    name: 'Кузнецова Марина Сергеевна',
    lastName: 'Кузнецова',
    firstName: 'Марина',
    middleName: 'Сергеевна',
    position: 'Инженер',
  },
  {
    username: 'operator',
    email: 'operator@esoft.local',
    password: 'operator12345',
    role: 'operator',
    name: 'Орлов Дмитрий Андреевич',
    lastName: 'Орлов',
    firstName: 'Дмитрий',
    middleName: 'Андреевич',
    position: 'Оператор оборудования',
  },
  {
    username: 'auditor',
    email: 'auditor@esoft.local',
    password: 'auditor12345',
    role: 'auditor',
    name: 'Белова Анна Викторовна',
    lastName: 'Белова',
    firstName: 'Анна',
    middleName: 'Викторовна',
    position: 'Аудитор',
  },
];

async function createAuthUser(user) {
  const response = await fetch('http://127.0.0.1:3000/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: user.name,
      email: user.email,
      password: user.password,
      username: user.username,
      displayUsername: user.username,
      rememberMe: false,
    }),
  });

  if (response.ok) {
    console.log(`created ${user.username}`);
    return;
  }

  if (response.status === 422) {
    console.log(`exists ${user.username}`);
    return;
  }

  throw new Error(`${user.username}: ${response.status} ${await response.text()}`);
}

async function updateCorporateFields() {
  const client = new Client({
    connectionString: 'postgresql://esoft:esoft_password@localhost:5433/esoft?schema=public',
  });

  await client.connect();

  try {
    for (const user of users) {
      await client.query(
        `
          UPDATE "user"
          SET
            name = $1,
            username = $2,
            "displayUsername" = $2,
            role = $3,
            last_name = $4,
            first_name = $5,
            middle_name = $6,
            position = $7
          WHERE email = $8
        `,
        [
          user.name,
          user.username,
          user.role,
          user.lastName,
          user.firstName,
          user.middleName,
          user.position,
          user.email,
        ],
      );
    }

    const result = await client.query(
      `
        SELECT username, email, role, last_name, first_name, middle_name, position
        FROM "user"
        WHERE username = ANY($1)
        ORDER BY username
      `,
      [users.map((user) => user.username)],
    );

    console.table(result.rows);
  } finally {
    await client.end();
  }
}

async function verifyLogins() {
  for (const user of users) {
    const response = await fetch('http://127.0.0.1:3000/api/auth/sign-in/username', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        password: user.password,
        rememberMe: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`login failed for ${user.username}: ${response.status} ${await response.text()}`);
    }

    console.log(`verified ${user.username}`);
  }
}

async function main() {
  for (const user of users) {
    await createAuthUser(user);
  }

  await updateCorporateFields();
  await verifyLogins();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
