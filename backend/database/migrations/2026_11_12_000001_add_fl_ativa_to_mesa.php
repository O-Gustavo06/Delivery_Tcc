<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mesa', function (Blueprint $table) {
            $table->boolean('fl_ativa')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('mesa', function (Blueprint $table) {
            $table->dropColumn('fl_ativa');
        });
    }
};
