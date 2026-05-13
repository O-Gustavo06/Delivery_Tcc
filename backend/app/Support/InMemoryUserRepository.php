<?php

namespace App\Support;

use Illuminate\Support\Facades\Hash;

class InMemoryUserRepository
{
    /** @var array<int, array<string, mixed>>|null */
    private static ?array $users = null;

    private static function boot(): void
    {
        if (self::$users !== null) {
            return;
        }

        self::$users = [
            1 => [
                'id' => 1,
                'name' => 'Admin',
                'email' => 'admin@local.test',
                'password' => Hash::make('admin123'),
                'role' => 'admin',
                'is_active' => true,
            ],
        ];
    }

    /** @return array<int, array<string, mixed>> */
    public function all(): array
    {
        self::boot();

        return array_values(self::$users);
    }

    /** @return array<string, mixed> */
    public function paginate(int $perPage, int $page): array
    {
        self::boot();

        $items = array_values(self::$users);
        $total = count($items);
        $page = max(1, $page);
        $offset = ($page - 1) * $perPage;

        return [
            'data' => array_slice($items, $offset, $perPage),
            'meta' => [
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => (int) ceil($total / $perPage),
            ],
        ];
    }

    /** @return array<string, mixed>|null */
    public function findById(int $id): ?array
    {
        self::boot();

        return self::$users[$id] ?? null;
    }

    /** @return array<string, mixed>|null */
    public function findByEmail(string $email): ?array
    {
        self::boot();

        foreach (self::$users as $user) {
            if (strcasecmp($user['email'], $email) === 0) {
                return $user;
            }
        }

        return null;
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    public function create(array $data): array
    {
        self::boot();

        $nextId = empty(self::$users) ? 1 : (max(array_keys(self::$users)) + 1);
        $data['id'] = $nextId;

        self::$users[$nextId] = $data;

        return $data;
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>|null
     */
    public function update(int $id, array $data): ?array
    {
        self::boot();

        if (!isset(self::$users[$id])) {
            return null;
        }

        self::$users[$id] = array_merge(self::$users[$id], $data);

        return self::$users[$id];
    }

    public function delete(int $id): bool
    {
        self::boot();

        if (!isset(self::$users[$id])) {
            return false;
        }

        unset(self::$users[$id]);

        return true;
    }

    public function makeToken(int $userId): string
    {
        return 'demo:' . $userId;
    }

    /** @return array<string, mixed>|null */
    public function findByToken(string $token): ?array
    {
        if (!str_starts_with($token, 'demo:')) {
            return null;
        }

        $id = (int) substr($token, 5);

        return $this->findById($id);
    }

    /** @param array<string, mixed> $user
     *  @return array<string, mixed>
     */
    public function toPublic(array $user): array
    {
        $public = $user;
        unset($public['password']);

        return $public;
    }

    /** @param array<int, array<string, mixed>> $users
     *  @return array<int, array<string, mixed>>
     */
    public function toPublicList(array $users): array
    {
        return array_map(fn (array $user) => $this->toPublic($user), $users);
    }
}
