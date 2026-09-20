<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Builder IDs are unsigned BIGINT even when the host model uses a UUID key.
            $table->foreignId('page_content_id')->nullable()->constrained('pagebuilder_contents')->restrictOnDelete();
            $table->foreignId('description_page_content_id')->nullable()->constrained('pagebuilder_contents')->restrictOnDelete();
        });
    }
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('page_content_id');
            $table->dropConstrainedForeignId('description_page_content_id');
        });
    }
};
