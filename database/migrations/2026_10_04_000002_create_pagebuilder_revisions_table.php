<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('pagebuilder_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_id')->nullable()->constrained('pagebuilder_contents')->cascadeOnDelete();
            $table->foreignId('template_id')->nullable()->constrained('pagebuilder_templates')->cascadeOnDelete();
            $table->unsignedInteger('revision');
            $table->json('payload');
            $table->timestamp('created_at');
            $table->unique(['content_id', 'revision']);
            $table->unique(['template_id', 'revision']);
        });
    }

    public function down(): void { Schema::dropIfExists('pagebuilder_revisions'); }
};
