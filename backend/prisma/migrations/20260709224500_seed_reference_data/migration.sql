INSERT INTO manufacturers (name)
VALUES
  ('Siemens'),
  ('Omron'),
  ('Bosch Rexroth'),
  ('Festo'),
  ('Schneider Electric'),
  ('ABB'),
  ('Mitsubishi Electric'),
  ('Danfoss'),
  ('Phoenix Contact'),
  ('Keyence')
ON CONFLICT (name) DO NOTHING;

INSERT INTO countries (name)
VALUES
  ('Германия'),
  ('Япония'),
  ('Китай'),
  ('США'),
  ('Франция'),
  ('Италия'),
  ('Швейцария'),
  ('Южная Корея'),
  ('Россия')
ON CONFLICT (name) DO NOTHING;

INSERT INTO workshops (name)
VALUES
  ('Производственный цех'),
  ('Участок контроля качества'),
  ('Склад готовой продукции'),
  ('Ремонтная зона')
ON CONFLICT (name) DO NOTHING;

WITH workshop_rows AS (
  SELECT id, name
  FROM workshops
)
INSERT INTO sections (workshop_id, name)
SELECT workshop_rows.id, section_rows.name
FROM (
  VALUES
    ('Производственный цех', 'Линия сборки 1'),
    ('Производственный цех', 'Линия сборки 2'),
    ('Производственный цех', 'Упаковочная линия'),
    ('Участок контроля качества', 'Лаборатория входного контроля'),
    ('Участок контроля качества', 'Пост финальной проверки'),
    ('Склад готовой продукции', 'Зона хранения'),
    ('Ремонтная зона', 'Пост диагностики'),
    ('Ремонтная зона', 'Пост обслуживания')
) AS section_rows(workshop_name, name)
JOIN workshop_rows ON workshop_rows.name = section_rows.workshop_name
ON CONFLICT (workshop_id, name) DO NOTHING;

INSERT INTO operations (name)
VALUES
  ('Сборка'),
  ('Контроль качества'),
  ('Упаковка'),
  ('Маркировка'),
  ('Транспортировка'),
  ('Диагностика'),
  ('Техническое обслуживание')
ON CONFLICT (name) DO NOTHING;

INSERT INTO employees (last_name, first_name, middle_name, position)
VALUES
  ('Иванов', 'Иван', 'Иванович', 'Инженер по эксплуатации'),
  ('Петрова', 'Анна', 'Сергеевна', 'Главный инженер'),
  ('Сидоров', 'Павел', 'Андреевич', 'Оператор линии'),
  ('Кузнецова', 'Мария', 'Викторовна', 'Аудитор качества'),
  ('Смирнов', 'Дмитрий', 'Олегович', 'Механик ремонтной зоны'),
  ('Орлова', 'Елена', 'Николаевна', 'Специалист склада')
ON CONFLICT DO NOTHING;
