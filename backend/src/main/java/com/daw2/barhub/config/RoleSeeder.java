package com.daw2.barhub.config;

import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.repository.RoleRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class RoleSeeder implements CommandLineRunner {

  private final RoleRepository roleRepository;

  public RoleSeeder(RoleRepository roleRepository) {
    this.roleRepository = roleRepository;
  }

  @Override
  public void run(String... args) {
    for (RoleEnum r : RoleEnum.values()) {
      if (roleRepository.findByName(r).isEmpty()) {
        roleRepository.save(Role.builder().name(r).build());
      }
    }
  }
}